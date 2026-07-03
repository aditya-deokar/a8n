export function buildMinimalWorkflowGraph() {
  return {
    nodes: [
      {
        id: "e2e_node_initial",
        type: "INITIAL",
        position: { x: 0, y: 0 },
        data: { label: "Start" },
      },
      {
        id: "e2e_node_openai",
        type: "OPENAI",
        position: { x: 180, y: 0 },
        data: { prompt: "Summarize a test payload" },
      },
    ],
    edges: [
      {
        source: "e2e_node_initial",
        target: "e2e_node_openai",
        sourceHandle: null,
        targetHandle: null,
      },
    ],
  };
}

export function buildManualWorkflowGraph() {
  return {
    nodes: [
      {
        id: "e2e_node_manual_trigger",
        type: "MANUAL_TRIGGER",
        position: { x: 0, y: 0 },
        data: { label: "Manual start" },
      },
      {
        id: "e2e_node_openai",
        type: "OPENAI",
        position: { x: 180, y: 0 },
        data: { prompt: "Summarize a test payload" },
      },
    ],
    edges: [
      {
        source: "e2e_node_manual_trigger",
        target: "e2e_node_openai",
        sourceHandle: null,
        targetHandle: null,
      },
    ],
  };
}

export function buildGoogleFormWorkflowGraph() {
  return {
    nodes: [
      {
        id: "e2e_node_google_form_trigger",
        type: "GOOGLE_FORM_TRIGGER",
        position: { x: 0, y: 0 },
        data: { label: "Google Form submission" },
      },
      {
        id: "e2e_node_openai",
        type: "OPENAI",
        position: { x: 180, y: 0 },
        data: { prompt: "Summarize a form submission" },
      },
    ],
    edges: [
      {
        source: "e2e_node_google_form_trigger",
        target: "e2e_node_openai",
        sourceHandle: null,
        targetHandle: null,
      },
    ],
  };
}

export function buildStripeWorkflowGraph() {
  return {
    nodes: [
      {
        id: "e2e_node_stripe_trigger",
        type: "STRIPE_TRIGGER",
        position: { x: 0, y: 0 },
        data: { label: "Stripe event" },
      },
      {
        id: "e2e_node_openai",
        type: "OPENAI",
        position: { x: 180, y: 0 },
        data: { prompt: "Summarize a Stripe event" },
      },
    ],
    edges: [
      {
        source: "e2e_node_stripe_trigger",
        target: "e2e_node_openai",
        sourceHandle: null,
        targetHandle: null,
      },
    ],
  };
}
