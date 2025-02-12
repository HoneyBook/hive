import React from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from './auth';
import { HttpProductAdapter, IOContextProvider } from './products';
import { Shop } from './shop';
import axios from 'axios';

const container = document.getElementById('root');
if (!container) throw new Error('Failed to find root element');
const root = createRoot(container);
root.render(
    <React.StrictMode>
        <AuthProvider user={{id: '1', name: 'John Doe'}}>
          <IOContextProvider 
            productsAdapter={new HttpProductAdapter(axios.create({baseURL: 'http://localhost:3000'}))}>
            <Shop />
          </IOContextProvider>
        </AuthProvider>
    </React.StrictMode>
);
