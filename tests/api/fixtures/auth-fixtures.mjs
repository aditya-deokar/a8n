const baseDate = new Date("2026-07-03T00:00:00.000Z");

export const apiUsers = {
  userAFree: {
    id: "user_a_free",
    name: "User A Free",
    email: "user-a-free@example.com",
    emailVerified: true,
    image: null,
    createdAt: baseDate,
    updatedAt: baseDate,
  },
  userAPro: {
    id: "user_a_pro",
    name: "User A Pro",
    email: "user-a-pro@example.com",
    emailVerified: true,
    image: null,
    createdAt: baseDate,
    updatedAt: baseDate,
  },
  userBPro: {
    id: "user_b_pro",
    name: "User B Pro",
    email: "user-b-pro@example.com",
    emailVerified: true,
    image: null,
    createdAt: baseDate,
    updatedAt: baseDate,
  },
};

export function createApiSession(user = apiUsers.userAPro) {
  return {
    user,
    session: {
      id: `session_${user.id}`,
      token: `session_token_${user.id}`,
      userId: user.id,
      expiresAt: new Date("2099-01-01T00:00:00.000Z"),
      createdAt: baseDate,
      updatedAt: baseDate,
    },
  };
}
