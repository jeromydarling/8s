// Shared domain model for 8 Seconds — used by both the Worker API and the SPA.

export type AgeDivision = "Pee Wee" | "Junior" | "Senior";
export type Association = "NHSRA" | "NJHRA" | "NLBRA" | "AJRA" | "JRA";
export type Discipline =
  | "Barrel Racing"
  | "Breakaway Roping"
  | "Pole Bending"
  | "Goat Tying"
  | "Tie-Down Roping"
  | "Team Roping"
  | "Chute Dogging"
  | "Steer Wrestling"
  | "Bareback"
  | "Saddle Bronc"
  | "Bull Riding"
  | "Calf Riding"
  | "Dummy Roping";

export interface Family {
  id: string;
  name: string;
  homeTown: string;
  state: string;
  plan: "Free" | "Arena Family" | "Arena Pro";
  motto: string;
}

export interface Contestant {
  id: string;
  familyId: string;
  firstName: string;
  lastName: string;
  age: number;
  division: AgeDivision;
  associations: Association[];
  disciplines: Discipline[];
  /** deterministic seed for the generated watercolor avatar */
  avatarSeed: string;
  backNumber: string;
  bio: string;
}

export interface Horse {
  id: string;
  familyId: string;
  name: string;
  barnName: string;
  breed: string;
  age: number;
  color: string;
  bloodlines: string;
  role: string; // e.g. "Barrel mare", "Heel horse"
  trainer: string;
  riderId: string | null;
  farrierDueDays: number; // days until next farrier
  vetDueDays: number;
  vaccinationsCurrent: boolean;
  insured: boolean;
  notes: string;
  record: string;
}

export interface RodeoEvent {
  id: string;
  name: string;
  association: Association;
  disciplines: Discipline[];
  divisions: AgeDivision[];
  venue: string;
  city: string;
  state: string;
  startDate: string; // ISO
  endDate: string;
  entryDeadline: string;
  drawPosted: boolean;
  feePerEvent: number;
  status: "open" | "closing-soon" | "drawn" | "closed";
  added: boolean; // is this family entered / watching
}

export interface RunLog {
  id: string;
  contestantId: string;
  horseId: string | null;
  eventName: string;
  discipline: Discipline;
  date: string;
  result: string; // "14.812" or "5.4" or "NT"
  placing: number | null;
  points: number;
  footing: string;
  notes: string;
}

export type LadderStatus = "on-track" | "at-risk" | "qualified" | "watch";

export interface LadderStage {
  label: string;
  state: "done" | "current" | "upcoming";
  detail: string;
}

export interface QualifyingLadder {
  id: string;
  contestantId: string;
  pathway: Association;
  discipline: Discipline;
  title: string;
  currentPoints: number;
  targetPoints: number;
  standing: string; // "3rd in district"
  status: LadderStatus;
  nextDeadline: string;
  nextDeadlineLabel: string;
  stages: LadderStage[];
}

export interface Sponsor {
  id: string;
  contestantId: string;
  brand: string;
  category: string;
  tier: "Bronze" | "Silver" | "Gold" | "Buckle";
  annualValue: number;
  status: "active" | "pending" | "renewal-due";
  renewalDate: string;
  deliverablesDone: number;
  deliverablesTotal: number;
}

export type ArenaStatus = "safe" | "watch" | "threatened" | "saved";

export interface Arena {
  id: string;
  name: string;
  city: string;
  state: string;
  status: ArenaStatus;
  yearsActive: number;
  threat: string;
  story: string;
  signatures: number;
  signatureGoal: number;
  economicImpact: number; // annual, USD
  supporters: number;
}

export interface BudgetCategory {
  category: string;
  spent: number;
  budget: number;
}

export interface Lead {
  id?: string;
  name: string;
  email: string;
  role: string;
  org?: string;
  state?: string;
  disciplines?: string;
  createdAt?: string;
}

export interface DemoDataset {
  family: Family;
  contestants: Contestant[];
  horses: Horse[];
  events: RodeoEvent[];
  runs: RunLog[];
  ladders: QualifyingLadder[];
  sponsors: Sponsor[];
  arenas: Arena[];
  budget: BudgetCategory[];
  season: {
    spend: number;
    eventsEntered: number;
    milesTraveled: number;
    buckles: number;
  };
}

export interface ImportResult {
  summary: string;
  detected: { contestants: number; horses: number; runs: number; events: number };
  records: Array<Record<string, string | number | null>>;
  warnings: string[];
  mappedFrom: string;
}
