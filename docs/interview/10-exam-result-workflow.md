# Exam Result Flow Demo

## Purpose

This workflow demonstrates a realistic education automation:

`Google Form Trigger -> Gemini -> Email -> Google Sheets`

A student submits exam answers through a Google Form webhook. Gemini grades and explains the result, the Email node sends the result to the student, and the Google Sheets node stores the final record.

## Seeded Workflow

Name: `Exam Result Flow - Google Form to Gemini Email Sheet`

Seed command:

```bash
pnpm seed:showcase
```

The seed is idempotent for `adityadeokar80@gmail.com`. It also updates the all-nodes demo so Email and Google Sheets are included after Slack.

## Sample Google Form Payload

POST this to:

```text
/api/webhooks/google-form?workflowId=<exam-workflow-id>
```

```json
{
  "formId": "exam-demo-form",
  "formTitle": "Web Development Basics Exam",
  "responseId": "response-001",
  "timestamp": "2026-06-20T10:30:00.000Z",
  "respondentEmail": "student@example.com",
  "responses": {
    "Student Name": "Rahul Sharma",
    "Roll Number": "CS-102",
    "Exam Title": "Web Development Basics",
    "Q1": "HTML is used to structure web pages.",
    "Q2": "CSS is used for styling.",
    "Q3": "JavaScript makes pages interactive.",
    "Q4": "HTTP is the request response protocol for web communication.",
    "Q5": "A database stores and retrieves application data."
  }
}
```

## Node Script

- Google Form Trigger receives `googleForm` context from the webhook route.
- Gemini grades Q1-Q5 against the seeded answer key and writes `geminiResult.text`.
- Email sends to `{{googleForm.respondentEmail}}` with subject `Your {{lookup googleForm.responses "Exam Title"}} result`.
- Google Sheets appends timestamp, student name, roll number, email, exam title, Gemini result text, and email message ID.

## Credentials To Replace

- `Demo Gemini Credential - replace`: real Google Gemini API key.
- `Demo SMTP Email Credential - replace`: SMTP JSON:

```json
{
  "host": "smtp.gmail.com",
  "port": 465,
  "secure": true,
  "user": "your-email@gmail.com",
  "pass": "your-app-password",
  "from": "Demo Results <your-email@gmail.com>"
}
```

- `Demo Google Sheets Credential - replace`: Google service-account JSON from Google Cloud.
- Google Sheets node `spreadsheetId`: the target spreadsheet ID.
- Google Sheets node `sheetName`: keep `Results` or change to your tab name.

Share the target Google Sheet with the service account `client_email`; otherwise append calls will fail.

## Sheet Headers

Create a tab named `Results` with these headers:

```text
timestamp | studentName | rollNumber | email | examTitle | geminiResult | emailMessageId
```

## Live Demo Checklist

1. Run `pnpm seed:showcase`.
2. Replace Gemini, SMTP, and Google Sheets placeholder credentials.
3. Set the Google Sheets node `spreadsheetId`.
4. Start the app and Inngest dev server.
5. Start ngrok with `pnpm demo:ngrok`.
6. POST the sample payload to the printed Exam Result Google Form webhook URL.
7. Confirm the execution succeeds, the student receives email, and the row appears in the sheet.
