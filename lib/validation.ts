import { z } from "zod";

export const JobSchema = z.object({
  title: z.string().min(3),
  department: z.string().min(2),
  qualification: z.string().min(2),
  vacancy: z.string(),
  salary: z.string(),
  ageLimit: z.string(),
  location: z.string(),
  applicationFee: z.string(),
  selectionProcess: z.string(),
  lastDate: z.string(),
  applyLink: z.string().url(),
  notificationLink: z.string().url(),
  officialWebsite: z.string().url(),
  category: z.string(),
});

export type JobInput = z.infer<typeof JobSchema>;