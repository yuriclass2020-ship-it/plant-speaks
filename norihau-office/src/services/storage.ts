import { defaultEmployees } from "../data/defaultEmployees";
import { defaultLogs, defaultSubscriptions } from "../data/defaultSubscriptions";
import { defaultProjects } from "../data/defaultProjects";
import type { ActivityLog, Employee, InboxItem, Project, Subscription, TaskReport } from "../types";

const KEYS = {
  employees: "norihau.v2.employees",
  projects: "norihau.v2.projects",
  subscriptions: "norihau.v2.subscriptions",
  logs: "norihau.v2.logs",
  reports: "norihau.v2.reports",
  inbox: "norihau.v2.inbox",
  migrated: "norihau.v3.migrated",
};

const LEGACY_SAMPLE_PROJECT_IDS = new Set([
  "project-plant-speaks",
  "project-mailbox",
  "project-emoticon",
  "project-todo",
]);

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

function migrateLegacyWorkspace() {
  try {
    if (localStorage.getItem(KEYS.migrated)) return;

    const rawProjects = read<Project[]>(KEYS.projects, []);
    const hasOnlyLegacySamples =
      rawProjects.length > 0 && rawProjects.every((project) => LEGACY_SAMPLE_PROJECT_IDS.has(project.id));

    if (hasOnlyLegacySamples) {
      write(KEYS.projects, []);
      write(KEYS.logs, []);
      write(KEYS.reports, []);
      write(KEYS.inbox, []);
    }

    localStorage.setItem(KEYS.migrated, "true");
  } catch {
    // Ignore migration issues and keep the current workspace as-is.
  }
}

migrateLegacyWorkspace();

export const storage = {
  getEmployees: () => read<Employee[]>(KEYS.employees, defaultEmployees),
  saveEmployees: (employees: Employee[]) => write(KEYS.employees, employees),
  getProjects: () => read<Project[]>(KEYS.projects, defaultProjects),
  saveProjects: (projects: Project[]) => write(KEYS.projects, projects),
  getSubscriptions: () => read<Subscription[]>(KEYS.subscriptions, defaultSubscriptions),
  saveSubscriptions: (subscriptions: Subscription[]) => write(KEYS.subscriptions, subscriptions),
  getLogs: () => read<ActivityLog[]>(KEYS.logs, defaultLogs),
  saveLogs: (logs: ActivityLog[]) => write(KEYS.logs, logs),
  getReports: () => read<TaskReport[]>(KEYS.reports, []),
  saveReports: (reports: TaskReport[]) => write(KEYS.reports, reports),
  getInbox: () => read<InboxItem[]>(KEYS.inbox, []),
  saveInbox: (inbox: InboxItem[]) => write(KEYS.inbox, inbox),
  addLog: (log: ActivityLog) => write(KEYS.logs, [log, ...read<ActivityLog[]>(KEYS.logs, defaultLogs)].slice(0, 40)),
  resetWorkspace: () => {
    write(KEYS.projects, []);
    write(KEYS.subscriptions, []);
    write(KEYS.logs, []);
    write(KEYS.reports, []);
    write(KEYS.inbox, []);
  },
};
