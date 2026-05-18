export const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
}

export const validatePassword = (password) => {
    return password.length >= 6
}

export const validateRequired = (value) => {
    return value && value.trim().length > 0
}
