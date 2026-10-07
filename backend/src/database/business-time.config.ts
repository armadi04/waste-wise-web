import postgres from 'pg';

// pg has no TypeScript declarations in this project; keep this adapter narrowly typed.
const pg = postgres as unknown as {
  defaults: { parseInputDatesAsUTC: boolean };
  types: {
    setTypeParser: (oid: number, parser: (value: string) => Date) => void;
  };
};
pg.defaults.parseInputDatesAsUTC = true;
pg.types.setTypeParser(
  1114,
  (value) => new Date(`${value.replace(' ', 'T')}Z`),
);
