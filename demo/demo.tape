# Renders demo.gif for the README - one clear, self-paced story.
# Prereqs: `npm install` here and a PostgreSQL at DATABASE_URL
# (defaults to postgres://postgres:postgres@localhost:5432/postgres).
# Render with:  vhs demo.tape
Output demo.gif

Set Shell bash
Set FontSize 18
Set Width 1040
Set Height 680
Set Padding 26
Set Theme "Dracula"
Set TypingSpeed 45ms

Hide
Type "export DATABASE_URL=${DATABASE_URL:-postgres://postgres:postgres@localhost:5432/postgres}" Enter
Type "node provision.mjs > /dev/null 2>&1" Enter
Type "clear" Enter
Show

Sleep 500ms
Type "node demo.mjs" Enter
Sleep 8s
