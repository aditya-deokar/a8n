export const E2E_PASSWORD = "E2e-test-password-123!";

export type E2EUserFixture = {
  name: string;
  email: string;
  password: string;
};

export function e2eEmail(label: string) {
  return `e2e_${label}_${Date.now()}@example.com`;
}

export function buildE2EUser(label: string): E2EUserFixture {
  const email = e2eEmail(label);
  return {
    name: email,
    email,
    password: E2E_PASSWORD,
  };
}
