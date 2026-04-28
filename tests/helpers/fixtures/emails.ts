export interface EmailFixture {
  subject: string;
  author: string;
  body: string;
  expectedLabel: string;
}

export const sampleEmails: EmailFixture[] = [
  {
    subject: "Your invoice #12345 from Acme Corp",
    author: "billing@acme.com",
    body: "Dear customer, your invoice #12345 is attached. Please remit payment by 2026-05-15.",
    expectedLabel: "Finance",
  },
  {
    subject: "Meeting tomorrow at 3pm",
    author: "boss@company.com",
    body: "Hi team, let's sync up tomorrow at 3pm regarding the Q2 roadmap.",
    expectedLabel: "Work",
  },
  {
    subject: "Your order has shipped!",
    author: "orders@shop.com",
    body: "Great news! Your order #ORD-001 has shipped. Track it here: https://track.shop.com/ORD-001",
    expectedLabel: "Shopping",
  },
  {
    subject: "Newsletter: Weekly Digest",
    author: "newsletter@technews.com",
    body: "This week in tech: AI breakthroughs, new frameworks, and more.",
    expectedLabel: "Newsletters",
  },
  {
    subject: "Invitation: Team Building Event",
    author: "hr@company.com",
    body: "You're invited to our quarterly team building event on May 1st.",
    expectedLabel: "Work",
  },
];
