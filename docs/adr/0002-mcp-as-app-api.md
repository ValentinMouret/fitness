# ADR 0002: Expose Fitness app capabilities through MCP

Status: Accepted

Date: 2026-09-14

## Context

Fitness is a solo-user app. Its Model Context Protocol (MCP) interface should let an external agent use the app on the owner's behalf. The owner wants to create and adapt workouts, manage nutrition, log measurements and habits, and read both individual records and historical data through conversation.

The external agent has the owner's conversational context and can learn preferences across interactions. Defining that agent's coaching, memory, or conversational behaviour as part of the MCP would couple the API to a particular way of using it.

## Decision

Build MCP as a simple API to Fitness application capabilities. Agents choose which operations to call and how to combine them, as the owner chooses actions in the web app.

The external agent owns preference learning, interpretation of instructions, recommendations, follow-up questions, and conversational workflow. For example, it decides how to accommodate "spare my shoulders today" or proposes a replacement exercise during a workout. Fitness exposes the reads and writes needed to carry out those decisions.

Fitness owns durable app records, domain rules, validation, persistence, and application calculations. MCP operations reuse existing application logic and enforce the same domain rules as the web app. Existing authentication and authorization requirements continue to apply.

The capability scope includes:

- Workouts: read, create, and modify workouts and recorded performance, including changes during a session.
- Nutrition: read nutritional information, log meals, and create missing food catalogue items.
- Measurements and habits: read records and log measurements, including body weight, and habit completion.
- History and analytics: retrieve individual records and date-range histories for workouts, meals, habits, and measurements; expose application aggregates and time series such as training volume per muscle group over time.

Tool names and granularity follow application operations and data access needs. They do not encode a prescribed coaching conversation. Saving a completed workout in one interaction and recording progress across several interactions are both API use cases; the MCP does not prescribe when the agent should log progress.

## Consequences

- MCP scope discussions focus on available operations, accepted data, query ranges, and returned results. The owner's preferred conversation style is not a prerequisite for defining the API.
- Learning preferences and retaining conversational context stay with the external agent. This MCP work does not introduce an agent memory or coaching system inside Fitness.
- Meal estimation and clarification choices belong to the agent. Fitness validates and persists the submitted nutrition data through its application rules.
- Domain calculations exposed by Fitness, such as volume time series, remain consistent across clients. The agent interprets those results.
- Embedded frontend components in chat clients are deferred. The API should support the intended reads and writes without requiring a switch to the web app.

This decision defines the MCP boundary and capability scope. It does not remove existing in-app AI features or settle individual tool schemas.
