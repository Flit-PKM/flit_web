/**
 * Feedback types for POST /api/feedback
 */

export interface FeedbackCreate {
	content: string;
	context?: Record<string, unknown> | null;
}

export interface FeedbackRead {
	id: number;
	content: string;
	context?: Record<string, unknown> | null;
	created_at: string;
}
