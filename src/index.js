import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import App from './App';
import PaymentSuccess from './PaymentSuccess';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/payment-success" element={<PaymentSuccess />} />
        <Route path="/payment-cancel" element={
          <div style={{ padding: 40, textAlign: "center" }}>
            <h2>❌ Payment cancelled</h2>
            <p>Your payment was cancelled. You can try again.</p>
          </div>
        } />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

// // // If you want to start measuring performance in your app, pass a function
// // // to log results (for example: reportWebVitals(console.log))
// // // or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
// // reportWebVitals();
// import React from "react";
// import ReactDOM from "react-dom/client";
// import { BrowserRouter, Routes, Route } from "react-router-dom";
// import "./index.css";
// import App from "./App";
// import PaymentSuccess from "./PaymentSuccess";

// const root = ReactDOM.createRoot(document.getElementById("root"));
// root.render(
//   <React.StrictMode>
//     <BrowserRouter>
//       <Routes>
//         <Route path="/" element={<App />} />
//         <Route path="/payment-success" element={<PaymentSuccess />} />
//         <Route
//           path="/payment-cancel"
//           element={
//             <div style={{ padding: 40, textAlign: "center" }}>
//               <h2>❌ Payment cancelled</h2>
//               <p>Your payment was cancelled. You can try again.</p>
//             </div>
//           }
//         />
//       </Routes>
//     </BrowserRouter>
//   </React.StrictMode>
// );
