import { jobs } from "../app/data/jobs";

export function getAllJobs() {
  return jobs;
}

export function getJobById(id: number) {
  return jobs.find((job) => job.id === id);
}