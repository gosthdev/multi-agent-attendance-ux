<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project: Smart Attendance & Justification System

## Context
This is a web system designed to handle attendance tracking using AWS Rekognition facial recognition alongside a justification manager (chat agent + file uploads).

## Technical Requirements
- **Package Manager**: Use ONLY `pnpm`. **NEVER** use `npm`, `yarn`, or `bun`.
- **UI Framework / Components**: Use standard `shadcn` components (`@/components/ui/...`) for layouts, cards, buttons, etc. Avoid creating manual HTML wrappers where a shadcn counterpart is available.
- **Next.js Version**: Next.js 16. Uses the new `proxy.ts` file convention instead of `middleware.ts` for intercepting routes.

## Authentication & Authorization
- **AWS Cognito**: Authenticates users directly from the client side hitting the AWS Cognito Identity Provider endpoints (using InitiateAuth flow).
- **Session Tokens**: Saving the Cognito **`IdToken`** in the `id_token` cookie. This token is passed as the authorization bearer header to backend API calls.
- **User Groups**: User roles are decoded from the `id_token` in the `"cognito:groups"` claims array. Possible roles are `admin`, `teacher`, and `parent`.

## Module Access Matrix (Sidebar Route Control)
Access to modules is strictly filtered based on the user's Cognito groups. If a user does not have permission, the module is completely hidden from the sidebar.

| Module ID | Label | Allowed Cognito Groups (Roles) |
| :--- | :--- | :--- |
| `administracion` | Administración | `admin`, `teacher` |
| `profesores` | Profesores | `admin` |
| `padres` | Padres de Familia | `admin`, `teacher` |
| `aulas` | Aulas | `admin`, `teacher` |
| `cursos` | Cursos | `admin`, `teacher` |
| `estudiantes` | Estudiantes | `admin`, `teacher`, `parent` |
| `asistencia` | Asistencia | `admin`, `teacher` |
| `justificaciones` | Justificaciones | `admin`, `teacher`, `parent` |
| `justificar` | Justificar | `parent` |

## Default Starting Views
- If the user has only the `teacher` group (and not `admin`), the dashboard default active tab is **`asistencia`**.
- In other cases, it defaults to the first available module in the filtered visible menu list (e.g. `administracion` for admin, `estudiantes` or `justificaciones` for parent).
