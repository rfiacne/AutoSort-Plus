export interface Attachment {
  name: string;
  contentType: string;
  size: number;
}

export interface EmailContext {
  subject: string;
  author: string;
  attachments: Attachment[];
  body: string;
}
