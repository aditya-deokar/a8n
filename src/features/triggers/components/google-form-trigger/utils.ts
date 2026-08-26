export const generateGoogleFormScript = (
  webhookUrl: string,
) => `function onFormSubmit(e) {
  // Paste your webhook secret here. It must match GOOGLE_FORM_WEBHOOK_SECRET
  // (or A8N_WEBHOOK_SHARED_SECRET) configured in the a8n deployment, or the
  // per-workflow secret you set in this trigger's settings.
  var WEBHOOK_SECRET = 'PASTE_YOUR_WEBHOOK_SECRET';

  var formResponse = e.response;
  var itemResponses = formResponse.getItemResponses();

  // Build responses object
  var responses = {};
  for (var i = 0; i < itemResponses.length; i++) {
    var itemResponse = itemResponses[i];
    responses[itemResponse.getItem().getTitle()] = itemResponse.getResponse();
  }

  // Prepare webhook payload
  var payload = {
    formId: e.source.getId(),
    formTitle: e.source.getTitle(),
    responseId: formResponse.getId(),
    timestamp: formResponse.getTimestamp(),
    respondentEmail: formResponse.getRespondentEmail(),
    responses: responses
  };

  // Send to webhook
  var options = {
    'method': 'post',
    'contentType': 'application/json',
    'headers': {
      'x-a8n-webhook-secret': WEBHOOK_SECRET
    },
    'payload': JSON.stringify(payload)
  };

  var WEBHOOK_URL = '${webhookUrl}';

  try {
    UrlFetchApp.fetch(WEBHOOK_URL, options);
  } catch(error) {
    console.error('Webhook failed:', error);
  }
}`;
