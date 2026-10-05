export function loader() {
  return Response.json(
    {
      status: "ok",
      mode: "synthetic-design-preview",
      revision: import.meta.env.FITNESS_PREVIEW_REVISION,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
