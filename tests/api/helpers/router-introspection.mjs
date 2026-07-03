function isProcedure(value) {
  return ["query", "mutation", "subscription"].includes(value?._def?.type);
}

function walkRecord(record, prefix = "") {
  const paths = [];

  for (const [key, value] of Object.entries(record ?? {})) {
    const nextPath = prefix ? `${prefix}.${key}` : key;

    if (isProcedure(value)) {
      paths.push(nextPath);
      continue;
    }

    const nestedRecord = value?._def?.record ?? value?._def?.procedures;
    if (nestedRecord) {
      paths.push(...walkRecord(nestedRecord, nextPath));
    }
  }

  return paths;
}

export function getRouterProcedurePaths(router) {
  if (router?._def?.procedures) {
    return Object.keys(router._def.procedures).sort();
  }

  return walkRecord(router?._def?.record).sort();
}
