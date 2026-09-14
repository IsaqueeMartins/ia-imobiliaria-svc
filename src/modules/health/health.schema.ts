import { z } from 'zod';

export const healthCheckSchema = z.object({
  name: z.string(),
  status: z.enum(['up', 'down', 'unconfigured']),
  details: z.record(z.string(), z.unknown()).optional(),
});

export const livenessResponseSchema = z.object({
  status: z.literal('ok'),
  environment: z.string(),
  uptimeSeconds: z.number(),
  timestamp: z.string(),
});

export const readinessResponseSchema = z.object({
  status: z.enum(['ready', 'not_ready']),
  checks: z.array(healthCheckSchema),
});

export type HealthCheck = z.infer<typeof healthCheckSchema>;
export type LivenessResponse = z.infer<typeof livenessResponseSchema>;
export type ReadinessResponse = z.infer<typeof readinessResponseSchema>;
