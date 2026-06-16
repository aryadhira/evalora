# EVALORA - Online Exams & Assessment Platform

## Tech Stack

**Backend**
- Go 1.26.4
- Go Fiber v3.3.0
- GORM v1.31.1
- Postgres 18

**Frontend**
- Next.js 16.2.9
- Shadcn ^4.11.0
- Radix UI

## Code Structure

`/docs` : folder that contains all documentation of this project such as PRD, architecture, design
`/backend` : go backend folder
`/frontend` : next.js frontend folder


## Instructions

**Workflow**
Everytime you did changes, you must log it into `/docs/memory/{datenow}.md`
memory document format will be :
- any discussion main point or any decision will write on ordered list
- any changes you did will write on checklist

**Backend**

There are different between folder structure and the architecture design docs, but please keep follow the current folder structure.
Current folder structure using **Repository Pattern**.
- cmd/main.go -> entrypoint
- config/confi.go -> app config handler
- internal 
    - database -> database connection
    - middleware -> middleware
    - migration -> migration handler
    - models -> domain struct and gorm model
    - repository -> interface + implementation no business logic
    - service -> business logic
    - handler -> HTTP handler
    - router -> app router
- pkg
    - utils -> all utilization function

