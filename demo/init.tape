# Renders demo.gif for the README - the guided `tenancyjs-cli init` wizard.
# The demo project (/tmp/tenancy-init-demo) has next + sequelize and a local
# install of the CLI, so `npx tenancyjs-cli` resolves instantly and offline.
# Render with:  vhs init.tape
Output demo.gif

Set Shell bash
Set FontSize 15
Set Width 1240
Set Height 900
Set Padding 26
Set Theme "Dracula"
Set TypingSpeed 55ms

Hide
Type "cd /tmp/tenancy-init-demo" Enter
Type "rm -rf tenancy.config.ts lib TENANCY.md AGENTS.md CLAUDE.md && clear" Enter
Show

Sleep 800ms
Type "npx tenancyjs-cli init" Enter
Sleep 3.5s
Type "1" Sleep 500ms Enter
Sleep 2s
Type "3" Sleep 500ms Enter
Sleep 3s
Type "1" Sleep 500ms Enter
Sleep 2s
Type "1" Sleep 500ms Enter
Sleep 6s
