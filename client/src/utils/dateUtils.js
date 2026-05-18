export const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    })
}

export const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
    })
}

export const calculateDaysSince = (date) => {
    const now = new Date()
    const past = new Date(date)
    const diff = now - past
    return Math.floor(diff / (1000 * 60 * 60 * 24))
}
