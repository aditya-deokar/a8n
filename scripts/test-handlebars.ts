import Handlebars from "handlebars";
import { decode } from "html-entities";

Handlebars.registerHelper("json", (context) => {
  const jsonString = JSON.stringify(context, null, 2);
  const safeString = new Handlebars.SafeString(jsonString);
  return safeString;
});

const rowJson = '[{{json googleForm.timestamp}}, {{json (lookup googleForm.responses "Student Name")}}, {{json (lookup googleForm.responses "Roll Number")}}, {{json googleForm.respondentEmail}}, {{json (lookup googleForm.responses "Exam Title")}}, {{json geminiResult.text}}, "{{emailResult.messageId}}"]';

const context = {
  googleForm: {
    timestamp: "2023-10-10",
    respondentEmail: "foo@bar.com",
    responses: {
      "Student Name": "John",
      "Roll Number": "123",
      "Exam Title": "Test"
    }
  },
  geminiResult: {
    text: "Great job!"
  },
  emailResult: {
    messageId: "12345"
  }
};

console.log("Valid context:");
console.log(decode(Handlebars.compile(rowJson)(context)));

const contextMissing = {
  googleForm: {
    timestamp: "2023-10-10",
    responses: {}
  },
  geminiResult: {},
  emailResult: {}
};

console.log("\nMissing context:");
console.log(decode(Handlebars.compile(rowJson)(contextMissing)));
