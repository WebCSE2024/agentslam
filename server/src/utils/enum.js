export const USER_ROLE = {
    SUPER_ADMIN: "super_admin",
    ADMIN: "admin",
    USER: "user",
}

export const USER_STATUS = {
    ACTIVE: "active",
    DISABLED: "disabled"
}

export const ROUND_STATUS = {
    CREATED: "created",
    READY: 'ready',
    ONGOING: "ongoing",
    COMPLETED: "completed",
}

export const MATCH_STATUS = {
    PENDING: "pending",
    ACTIVE: "active",
    STARTED: "started",
    PAUSED: "paused",
    COMPLETED: "completed"
}

export const TOPIC_TYPE = {
    PROS:"pros",
    CONS:"cons"
}

export const TEAM_NAME = {
    TEAM1: "team1",
    TEAM2: "team2"
}

export const WINNER_TYPE = {

    CURRENT:"current",
    PREVIOUS:"previous",
}

export const SOCKET_MESSAGE_TYPE = {

    WELCOME: "welcome",
    USER_JOINED: "user-joined",
    USER_LEFT: "user-left",
    INFO: "info",
    ERROR: "error",
    MATCH_UPDATE: "match-update",
    MATCH_STATE: "match-state",
    MATCH_PAUSED: "match-paused",
    MATCH_RESUMED: "match-resumed",
    DEBATE_MESSAGE: "debate-message",
}