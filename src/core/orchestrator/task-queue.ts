/**
 * Task Queue - Async Task Coordination System
 *
 * This module provides a priority-based asynchronous task queue for coordinating
 * agent execution. It supports:
 * - Priority queuing (higher priority tasks execute first)
 * - Concurrency limits (control parallel execution)
 * - Task status tracking
 * - Timeout handling
 * - Task dependencies
 *
 * @module core/orchestrator/task-queue
 */

import type { AgentTask, AgentResult } from '../../types/index.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Status of a queued task.
 */
export type QueuedTaskStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'timeout'
  | 'cancelled';

/**
 * A task wrapped with queue metadata.
 */
export interface QueuedTask {
  /** Unique task identifier */
  id: string;
  /** The actual agent task */
  task: AgentTask;
  /** Priority (higher = more urgent) */
  priority: number;
  /** Current status */
  status: QueuedTaskStatus;
  /** When the task was enqueued */
  enqueuedAt: Date;
  /** When the task started running */
  startedAt?: Date;
  /** When the task completed (success or failure) */
  completedAt?: Date;
  /** Timeout in milliseconds */
  timeoutMs: number;
  /** Result if completed successfully */
  result?: AgentResult;
  /** Error if failed */
  error?: Error;
  /** Task IDs this task depends on */
  dependsOn?: string[];
  /** Retry count */
  retryCount: number;
  /** Maximum retries allowed */
  maxRetries: number;
}

/**
 * Task executor function type.
 */
export type TaskExecutor = (task: AgentTask) => Promise<AgentResult>;

/**
 * Configuration for the task queue.
 */
export interface TaskQueueConfig {
  /** Maximum concurrent tasks */
  maxConcurrency: number;
  /** Default timeout for tasks (ms) */
  defaultTimeoutMs: number;
  /** Maximum queue size (0 = unlimited) */
  maxQueueSize: number;
  /** Whether priority queuing is enabled */
  enablePriority: boolean;
  /** Default max retries for failed tasks */
  defaultMaxRetries: number;
  /** Delay between retry attempts (ms) */
  retryDelayMs: number;
}

/**
 * Event types emitted by the queue.
 */
export type TaskQueueEvent =
  | { type: 'task_enqueued'; task: QueuedTask }
  | { type: 'task_started'; task: QueuedTask }
  | { type: 'task_completed'; task: QueuedTask; result: AgentResult }
  | { type: 'task_failed'; task: QueuedTask; error: Error }
  | { type: 'task_timeout'; task: QueuedTask }
  | { type: 'task_cancelled'; task: QueuedTask }
  | { type: 'task_retry'; task: QueuedTask; attempt: number }
  | { type: 'queue_empty' }
  | { type: 'queue_full' };

/**
 * Event listener function type.
 */
export type TaskQueueEventListener = (event: TaskQueueEvent) => void;

/**
 * Queue statistics.
 */
export interface QueueStats {
  /** Number of pending tasks */
  pending: number;
  /** Number of running tasks */
  running: number;
  /** Number of completed tasks */
  completed: number;
  /** Number of failed tasks */
  failed: number;
  /** Total tasks processed */
  totalProcessed: number;
  /** Average execution time (ms) */
  averageExecutionTimeMs: number;
  /** Current concurrency */
  currentConcurrency: number;
  /** Maximum concurrency */
  maxConcurrency: number;
}

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_CONFIG: TaskQueueConfig = {
  maxConcurrency: 3,
  defaultTimeoutMs: 60000,
  maxQueueSize: 100,
  enablePriority: true,
  defaultMaxRetries: 2,
  retryDelayMs: 1000,
};

// =============================================================================
// Task Queue Class
// =============================================================================

/**
 * Priority-based asynchronous task queue for agent coordination.
 *
 * Tasks are executed based on priority (higher first) with concurrency limits.
 * Supports timeout handling, task dependencies, retries, and event notifications.
 */
export class TaskQueue {
  private config: TaskQueueConfig;
  private queue: QueuedTask[] = [];
  private running: Map<string, QueuedTask> = new Map();
  private completed: Map<string, QueuedTask> = new Map();
  private executor: TaskExecutor | null = null;
  private listeners: Set<TaskQueueEventListener> = new Set();
  private isProcessing: boolean = false;
  private taskIdCounter: number = 0;
  private totalExecutionTime: number = 0;
  private totalCompleted: number = 0;

  constructor(config: Partial<TaskQueueConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ===========================================================================
  // Public Methods - Queue Management
  // ===========================================================================

  /**
   * Set the task executor function.
   * This is called for each task when it runs.
   *
   * @param executor - Function to execute tasks
   */
  setExecutor(executor: TaskExecutor): void {
    this.executor = executor;
  }

  /**
   * Enqueue a task for execution.
   *
   * @param task - The agent task to enqueue
   * @param options - Optional configuration overrides
   * @returns The queued task wrapper
   */
  enqueue(
    task: AgentTask,
    options: {
      priority?: number;
      timeoutMs?: number;
      dependsOn?: string[];
      maxRetries?: number;
    } = {}
  ): QueuedTask {
    // Check queue size limit
    if (
      this.config.maxQueueSize > 0 &&
      this.queue.length >= this.config.maxQueueSize
    ) {
      this.emit({ type: 'queue_full' });
      throw new Error('Queue is full');
    }

    const queuedTask: QueuedTask = {
      id: this.generateTaskId(),
      task,
      priority: options.priority ?? 0,
      status: 'pending',
      enqueuedAt: new Date(),
      timeoutMs: options.timeoutMs ?? this.config.defaultTimeoutMs,
      dependsOn: options.dependsOn,
      retryCount: 0,
      maxRetries: options.maxRetries ?? this.config.defaultMaxRetries,
    };

    // Insert based on priority if enabled
    if (this.config.enablePriority) {
      const insertIndex = this.findInsertIndex(queuedTask.priority);
      this.queue.splice(insertIndex, 0, queuedTask);
    } else {
      this.queue.push(queuedTask);
    }

    this.emit({ type: 'task_enqueued', task: queuedTask });

    // Start processing if not already
    this.processQueue();

    return queuedTask;
  }

  /**
   * Enqueue multiple tasks at once.
   *
   * @param tasks - Array of tasks with options
   * @returns Array of queued task wrappers
   */
  enqueueAll(
    tasks: Array<{
      task: AgentTask;
      priority?: number;
      timeoutMs?: number;
      dependsOn?: string[];
    }>
  ): QueuedTask[] {
    return tasks.map(({ task, ...options }) => this.enqueue(task, options));
  }

  /**
   * Cancel a pending task.
   *
   * @param taskId - ID of the task to cancel
   * @returns True if the task was cancelled
   */
  cancel(taskId: string): boolean {
    const index = this.queue.findIndex((t) => t.id === taskId);

    if (index >= 0) {
      const task = this.queue.splice(index, 1)[0];
      task.status = 'cancelled';
      task.completedAt = new Date();
      this.completed.set(task.id, task);
      this.emit({ type: 'task_cancelled', task });
      return true;
    }

    return false;
  }

  /**
   * Cancel all pending tasks.
   *
   * @returns Number of tasks cancelled
   */
  cancelAll(): number {
    const count = this.queue.length;

    for (const task of this.queue) {
      task.status = 'cancelled';
      task.completedAt = new Date();
      this.completed.set(task.id, task);
      this.emit({ type: 'task_cancelled', task });
    }

    this.queue = [];
    return count;
  }

  /**
   * Wait for a specific task to complete.
   *
   * @param taskId - ID of the task to wait for
   * @param timeoutMs - Maximum wait time
   * @returns The completed task
   */
  async waitFor(taskId: string, timeoutMs?: number): Promise<QueuedTask> {
    const checkInterval = 100;
    const maxWait = timeoutMs ?? this.config.defaultTimeoutMs;
    let waited = 0;

    while (waited < maxWait) {
      // Check if completed
      const completed = this.completed.get(taskId);
      if (completed) {
        return completed;
      }

      // Check if still running
      const running = this.running.get(taskId);
      if (running) {
        await this.sleep(checkInterval);
        waited += checkInterval;
        continue;
      }

      // Check if still pending
      const pending = this.queue.find((t) => t.id === taskId);
      if (pending) {
        await this.sleep(checkInterval);
        waited += checkInterval;
        continue;
      }

      // Task not found
      throw new Error(`Task not found: ${taskId}`);
    }

    throw new Error(`Timeout waiting for task: ${taskId}`);
  }

  /**
   * Wait for all tasks in the queue to complete.
   *
   * @param timeoutMs - Maximum wait time
   * @returns All completed tasks
   */
  async waitForAll(timeoutMs?: number): Promise<QueuedTask[]> {
    const checkInterval = 100;
    const maxWait = timeoutMs ?? this.config.defaultTimeoutMs * 10;
    let waited = 0;

    while (waited < maxWait) {
      if (this.queue.length === 0 && this.running.size === 0) {
        return Array.from(this.completed.values());
      }

      await this.sleep(checkInterval);
      waited += checkInterval;
    }

    throw new Error('Timeout waiting for all tasks');
  }

  // ===========================================================================
  // Public Methods - Task Status
  // ===========================================================================

  /**
   * Get a task by ID.
   *
   * @param taskId - The task ID
   * @returns The task or undefined
   */
  getTask(taskId: string): QueuedTask | undefined {
    return (
      this.queue.find((t) => t.id === taskId) ||
      this.running.get(taskId) ||
      this.completed.get(taskId)
    );
  }

  /**
   * Get all pending tasks.
   */
  getPending(): QueuedTask[] {
    return [...this.queue];
  }

  /**
   * Get all running tasks.
   */
  getRunning(): QueuedTask[] {
    return Array.from(this.running.values());
  }

  /**
   * Get all completed tasks.
   */
  getCompleted(): QueuedTask[] {
    return Array.from(this.completed.values());
  }

  /**
   * Get queue statistics.
   */
  getStats(): QueueStats {
    const failed = Array.from(this.completed.values()).filter(
      (t) => t.status === 'failed' || t.status === 'timeout'
    ).length;

    return {
      pending: this.queue.length,
      running: this.running.size,
      completed: this.completed.size - failed,
      failed,
      totalProcessed: this.totalCompleted,
      averageExecutionTimeMs:
        this.totalCompleted > 0
          ? this.totalExecutionTime / this.totalCompleted
          : 0,
      currentConcurrency: this.running.size,
      maxConcurrency: this.config.maxConcurrency,
    };
  }

  /**
   * Check if the queue is empty and no tasks are running.
   */
  isIdle(): boolean {
    return this.queue.length === 0 && this.running.size === 0;
  }

  /**
   * Check if the queue has capacity for more tasks.
   */
  hasCapacity(): boolean {
    return (
      this.config.maxQueueSize === 0 ||
      this.queue.length < this.config.maxQueueSize
    );
  }

  // ===========================================================================
  // Public Methods - Events
  // ===========================================================================

  /**
   * Subscribe to queue events.
   *
   * @param listener - Event listener function
   * @returns Unsubscribe function
   */
  on(listener: TaskQueueEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Remove an event listener.
   *
   * @param listener - The listener to remove
   */
  off(listener: TaskQueueEventListener): void {
    this.listeners.delete(listener);
  }

  // ===========================================================================
  // Public Methods - Configuration
  // ===========================================================================

  /**
   * Update queue configuration.
   *
   * @param config - Partial configuration to update
   */
  configure(config: Partial<TaskQueueConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration.
   */
  getConfig(): TaskQueueConfig {
    return { ...this.config };
  }

  /**
   * Clear completed tasks from memory.
   *
   * @param olderThanMs - Only clear tasks older than this (0 = all)
   * @returns Number of tasks cleared
   */
  clearCompleted(olderThanMs: number = 0): number {
    if (olderThanMs === 0) {
      const count = this.completed.size;
      this.completed.clear();
      return count;
    }

    const cutoff = Date.now() - olderThanMs;
    let count = 0;

    for (const [id, task] of this.completed) {
      if (task.completedAt && task.completedAt.getTime() < cutoff) {
        this.completed.delete(id);
        count++;
      }
    }

    return count;
  }

  // ===========================================================================
  // Private Methods - Queue Processing
  // ===========================================================================

  /**
   * Process the queue, starting tasks up to concurrency limit.
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      while (this.queue.length > 0) {
        // Check concurrency limit
        if (this.running.size >= this.config.maxConcurrency) {
          break;
        }

        // Find next runnable task
        const taskIndex = this.findNextRunnableTask();
        if (taskIndex < 0) {
          break;
        }

        // Start the task
        const queuedTask = this.queue.splice(taskIndex, 1)[0];
        this.startTask(queuedTask);
      }

      // Emit queue empty if applicable
      if (this.queue.length === 0 && this.running.size === 0) {
        this.emit({ type: 'queue_empty' });
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Find the next task that can be run (dependencies satisfied).
   */
  private findNextRunnableTask(): number {
    for (let i = 0; i < this.queue.length; i++) {
      const task = this.queue[i];

      // Check if dependencies are satisfied
      if (this.dependenciesSatisfied(task)) {
        return i;
      }
    }

    return -1;
  }

  /**
   * Check if a task's dependencies are satisfied.
   */
  private dependenciesSatisfied(task: QueuedTask): boolean {
    if (!task.dependsOn || task.dependsOn.length === 0) {
      return true;
    }

    for (const depId of task.dependsOn) {
      const dep = this.completed.get(depId);

      // Dependency not completed
      if (!dep) {
        return false;
      }

      // Dependency failed
      if (dep.status !== 'completed') {
        return false;
      }
    }

    return true;
  }

  /**
   * Start executing a task.
   */
  private async startTask(queuedTask: QueuedTask): Promise<void> {
    if (!this.executor) {
      throw new Error('No executor set');
    }

    queuedTask.status = 'running';
    queuedTask.startedAt = new Date();
    this.running.set(queuedTask.id, queuedTask);

    this.emit({ type: 'task_started', task: queuedTask });

    try {
      // Execute with timeout
      const result = await this.executeWithTimeout(
        queuedTask.task,
        queuedTask.timeoutMs
      );

      // Success
      queuedTask.status = 'completed';
      queuedTask.result = result;
      queuedTask.completedAt = new Date();

      const executionTime =
        queuedTask.completedAt.getTime() - queuedTask.startedAt.getTime();
      this.totalExecutionTime += executionTime;
      this.totalCompleted++;

      this.emit({ type: 'task_completed', task: queuedTask, result });
    } catch (error) {
      // Handle timeout
      if ((error as Error).message === 'Task timeout') {
        queuedTask.status = 'timeout';
        queuedTask.error = error as Error;
        queuedTask.completedAt = new Date();
        this.emit({ type: 'task_timeout', task: queuedTask });
      } else {
        // Handle retry
        if (queuedTask.retryCount < queuedTask.maxRetries) {
          queuedTask.retryCount++;
          queuedTask.status = 'pending';
          queuedTask.startedAt = undefined;
          this.running.delete(queuedTask.id);

          this.emit({
            type: 'task_retry',
            task: queuedTask,
            attempt: queuedTask.retryCount,
          });

          // Re-enqueue with delay
          await this.sleep(this.config.retryDelayMs);
          this.queue.unshift(queuedTask); // Add to front for retry
          this.processQueue();
          return;
        }

        // Failed after retries
        queuedTask.status = 'failed';
        queuedTask.error = error as Error;
        queuedTask.completedAt = new Date();
        this.emit({ type: 'task_failed', task: queuedTask, error: error as Error });
      }
    } finally {
      this.running.delete(queuedTask.id);
      this.completed.set(queuedTask.id, queuedTask);

      // Continue processing queue
      this.processQueue();
    }
  }

  /**
   * Execute a task with timeout.
   */
  private async executeWithTimeout(
    task: AgentTask,
    timeoutMs: number
  ): Promise<AgentResult> {
    let timeoutId: NodeJS.Timeout;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('Task timeout')), timeoutMs);
    });

    try {
      const result = await Promise.race([
        this.executor!(task),
        timeoutPromise,
      ]);
      clearTimeout(timeoutId!);
      return result;
    } catch (error) {
      clearTimeout(timeoutId!);
      throw error;
    }
  }

  // ===========================================================================
  // Private Methods - Utilities
  // ===========================================================================

  /**
   * Find the insertion index for priority-based queuing.
   */
  private findInsertIndex(priority: number): number {
    for (let i = 0; i < this.queue.length; i++) {
      if (this.queue[i].priority < priority) {
        return i;
      }
    }
    return this.queue.length;
  }

  /**
   * Generate a unique task ID.
   */
  private generateTaskId(): string {
    return `task-${Date.now()}-${++this.taskIdCounter}`;
  }

  /**
   * Emit an event to all listeners.
   */
  private emit(event: TaskQueueEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in task queue event listener:', error);
      }
    }
  }

  /**
   * Sleep for a duration.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// =============================================================================
// Exports
// =============================================================================

export default TaskQueue;
