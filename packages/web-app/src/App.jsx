import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';

function Dashboard() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-4">Dashboard</h1>
      <p className="text-gray-600">Welcome to Implications Framework</p>
      
      <div className="mt-8 grid grid-cols-3 gap-4">
        <div className="p-6 border rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-2">Projects</h2>
          <p className="text-sm text-gray-600">Manage connected projects</p>
        </div>
        
        <div className="p-6 border rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-2">State Machines</h2>
          <p className="text-sm text-gray-600">Visualize workflows</p>
        </div>
        
        <div className="p-6 border rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-2">Generator</h2>
          <p className="text-sm text-gray-600">Create implications</p>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex">
                <Link to="/" className="flex items-center px-2 text-xl font-bold text-blue-600">
                  🎯 Implications Framework
                </Link>
              </div>
              
              <div className="flex items-center space-x-4">
                <Link to="/" className="px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900">
                  Dashboard
                </Link>
                <Link to="/projects" className="px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900">
                  Projects
                </Link>
                <Link to="/visualizer" className="px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900">
                  Visualizer
                </Link>
              </div>
            </div>
          </div>
        </nav>
        
        <main>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/projects" element={<div className="p-8">Projects (coming soon)</div>} />
            <Route path="/visualizer" element={<div className="p-8">Visualizer (coming soon)</div>} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;