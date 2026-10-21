export type Deadline = {
  id: string;
  title: string;
  due_at: string;
  type: string | null;
  course: string | null;
  done: boolean;
  source: string | null;
  created_at: string;
};
