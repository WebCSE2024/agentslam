import { createContext, useContext, useState, useEffect } from 'react'
import { api } from '../api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
    const [team, setTeam] = useState(null)
    const [loading, setLoading] = useState(true)

    // Rehydrate from localStorage on mount
    useEffect(() => {
        const stored = localStorage.getItem('team')
        if (stored) setTeam(JSON.parse(stored))
        setLoading(false)
    }, [])

    const login = async (email, password) => {
        const { data } = await api.post('/auth/login', { email, password })
        localStorage.setItem('token', data.token)
        localStorage.setItem('team', JSON.stringify(data))
        setTeam(data)
        return data
    }

    const register = async (name, email, password) => {
        const { data } = await api.post('/auth/register', { name, email, password })
        localStorage.setItem('token', data.token)
        localStorage.setItem('team', JSON.stringify(data))
        setTeam(data)
        return data
    }

    const logout = () => {
        localStorage.removeItem('token')
        localStorage.removeItem('team')
        setTeam(null)
    }

    return (
        <AuthContext.Provider value={{ team, loading, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    return useContext(AuthContext)
}
