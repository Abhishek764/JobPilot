export interface Resume {
  id: string;
  userId: string;
  title: string;
  content: string;
  fileUrl: string | null;
  parsedSkills: string[];
  parsedYears: number | null;
  createdAt: Date;
  updatedAt: Date;
}
