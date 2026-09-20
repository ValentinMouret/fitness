import { err, ok, type Result } from "neverthrow";

export const exposedViews = [
  "workouts",
  "workout_exercises",
  "sets",
  "exercises",
  "exercise_muscles",
  "muscle_volume",
] as const;
export const queryLimits = {
  sqlBytes: 20000,
  rows: 500,
  bytes: 262144,
  timeoutMs: 3000,
} as const;
export const allowedFunctions = [
  "count",
  "sum",
  "avg",
  "min",
  "max",
  "round",
  "abs",
  "ceil",
  "ceiling",
  "floor",
  "sqrt",
  "power",
  "mod",
  "date_trunc",
  "date_part",
  "extract",
  "timezone",
  "to_char",
  "to_date",
  "now",
  "lower",
  "upper",
  "length",
  "char_length",
  "btrim",
  "ltrim",
  "rtrim",
  "trim",
  "substring",
  "substr",
  "concat",
  "concat_ws",
  "string_agg",
  "array_agg",
  "json_agg",
  "jsonb_agg",
  "json_build_object",
  "jsonb_build_object",
  "row_to_json",
  "to_json",
  "to_jsonb",
  "row_number",
  "rank",
  "dense_rank",
  "lag",
  "lead",
  "first_value",
  "last_value",
  "ntile",
  "percentile_cont",
  "percentile_disc",
  "stddev",
  "stddev_pop",
  "stddev_samp",
  "variance",
  "var_pop",
  "var_samp",
  "bool_and",
  "bool_or",
  "generate_series",
] as const;
const nodes = new Set([
  "SelectStmt",
  "ResTarget",
  "RangeVar",
  "RangeSubselect",
  "RangeFunction",
  "JoinExpr",
  "ColumnRef",
  "A_Star",
  "A_Const",
  "A_Expr",
  "BoolExpr",
  "NullTest",
  "BooleanTest",
  "FuncCall",
  "TypeCast",
  "CaseExpr",
  "CaseWhen",
  "CoalesceExpr",
  "MinMaxExpr",
  "SubLink",
  "RowExpr",
  "A_ArrayExpr",
  "A_Indirection",
  "A_Indices",
  "SortBy",
  "WindowDef",
  "GroupingSet",
  "GroupingFunc",
  "CommonTableExpr",
  "WithClause",
  "Alias",
  "List",
  "String",
  "Integer",
  "Float",
  "Boolean",
  "SQLValueFunction",
]);
const types = new Set([
  "text",
  "varchar",
  "bpchar",
  "bool",
  "boolean",
  "int2",
  "int4",
  "int8",
  "integer",
  "bigint",
  "smallint",
  "numeric",
  "decimal",
  "float4",
  "float8",
  "real",
  "double precision",
  "date",
  "timestamp",
  "timestamptz",
  "time",
  "timetz",
  "interval",
  "uuid",
  "json",
  "jsonb",
]);
const operators = new Set([
  "+",
  "-",
  "*",
  "/",
  "%",
  "^",
  "=",
  "<>",
  "!=",
  "<",
  ">",
  "<=",
  ">=",
  "~~",
  "!~~",
  "~~*",
  "!~~*",
  "||",
  "->",
  "->>",
  "#>",
  "#>>",
  "@>",
  "<@",
  "?",
  "?|",
  "?&",
]);
function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function names(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) =>
    object(entry) &&
    object(entry.String) &&
    typeof entry.String.sval === "string"
      ? [entry.String.sval]
      : [],
  );
}

/** Validate the PostgreSQL AST in addition to database permissions. */
export function validateQueryAst(ast: unknown): Result<void, string> {
  if (!object(ast) || !Array.isArray(ast.stmts) || ast.stmts.length !== 1)
    return err("Provide exactly one SELECT statement");
  const statement = ast.stmts[0];
  if (
    !object(statement) ||
    !object(statement.stmt) ||
    !object(statement.stmt.SelectStmt)
  )
    return err("Only SELECT queries are allowed");
  function inspect(
    value: unknown,
    ctes: ReadonlySet<string>,
  ): string | undefined {
    if (Array.isArray(value)) {
      for (const entry of value) {
        const error = inspect(entry, ctes);
        if (error) return error;
      }
      return;
    }
    if (!object(value)) return;
    for (const [key, entry] of Object.entries(value)) {
      if (/^[A-Z]/.test(key) && !nodes.has(key))
        return `SQL construct ${key} is not exposed`;
      if (key === "SelectStmt" && object(entry)) {
        if (entry.intoClause || entry.lockingClause)
          return "SELECT INTO and row locking are not allowed";
        const scope = new Set(ctes);
        const { withClause, ...query } = entry;
        if (object(withClause)) {
          const definitions = Array.isArray(withClause.ctes)
            ? withClause.ctes
            : [];
          if (withClause.recursive) {
            for (const definition of definitions) {
              if (
                object(definition) &&
                object(definition.CommonTableExpr) &&
                typeof definition.CommonTableExpr.ctename === "string"
              )
                scope.add(definition.CommonTableExpr.ctename);
            }
          }
          for (const definition of definitions) {
            const error = inspect(definition, scope);
            if (error) return error;
            if (
              object(definition) &&
              object(definition.CommonTableExpr) &&
              typeof definition.CommonTableExpr.ctename === "string"
            )
              scope.add(definition.CommonTableExpr.ctename);
          }
          const { ctes: _, ...metadata } = withClause;
          const error = inspect(metadata, scope);
          if (error) return error;
        }
        const error = inspect(query, scope);
        if (error) return error;
        continue;
      }
      if (key === "RangeVar" && object(entry)) {
        if (
          entry.catalogname ||
          (entry.schemaname && entry.schemaname !== "fitness_data")
        )
          return "Query only fitness_data views";
        if (
          typeof entry.relname !== "string" ||
          (!exposedViews.some((name) => name === entry.relname) &&
            !(entry.schemaname === undefined && ctes.has(entry.relname)))
        )
          return "Unknown view; call describe_schema";
      }
      if (key === "FuncCall" && object(entry)) {
        const path = names(entry.funcname);
        if (
          path.length < 1 ||
          path.length > 2 ||
          (path.length === 2 && path[0] !== "pg_catalog") ||
          !allowedFunctions.some((name) => name === path.at(-1))
        )
          return `Function ${path.join(".")} is not allowed`;
      }
      if (key === "TypeCast" && object(entry) && object(entry.typeName)) {
        const path = names(entry.typeName.names);
        if (
          path.length < 1 ||
          path.length > 2 ||
          (path.length === 2 && path[0] !== "pg_catalog") ||
          !types.has(path.at(-1) ?? "")
        )
          return "Only built-in scalar casts are allowed";
      }
      if (key === "A_Expr" && object(entry)) {
        const path = names(entry.name);
        const between =
          typeof entry.kind === "string" &&
          [
            "AEXPR_BETWEEN",
            "AEXPR_NOT_BETWEEN",
            "AEXPR_BETWEEN_SYM",
            "AEXPR_NOT_BETWEEN_SYM",
          ].includes(entry.kind);
        if (!between && (path.length !== 1 || !operators.has(path[0])))
          return "Operator is not allowed";
      }
      if (key === "SortBy" && object(entry) && entry.useOp)
        return "Custom ordering operators are not allowed";
      const error = inspect(entry, ctes);
      if (error) return error;
    }
  }
  const error = inspect(statement.stmt, new Set());
  return error ? err(error) : ok(undefined);
}
