import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Provider } from 'react-redux'
import store from '../app/store'
import Layout from '../layouts/Layout'
import HomePage from '../pages/HomePage'

function App() {
    return (
        <Provider store={store}>
            <Router>
                <Routes>
                    <Route element={<Layout />}>
                        <Route path="/" element={<HomePage />} />
                    </Route>
                </Routes>
            </Router>
        </Provider>
    )
}

export default App
