// Script de débogage pour les toasts React-Toastify
// À ajouter temporairement dans un composant pour tester

import React, { useEffect } from 'react';
import { toast } from 'react-toastify';

const ToastDebugger = () => {
  useEffect(() => {
    console.log('🧪 [ToastDebugger] Composant monté');
    
    // Test 1: Toast simple
    setTimeout(() => {
      console.log('🧪 [ToastDebugger] Test toast simple...');
      toast.success('Test toast simple - Si vous voyez ceci, les toasts fonctionnent !');
    }, 1000);

    // Test 2: Toast avec options
    setTimeout(() => {
      console.log('🧪 [ToastDebugger] Test toast avec options...');
      toast.info('Test toast avec options personnalisées', {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true
      });
    }, 2000);

    // Test 3: Toast d'erreur
    setTimeout(() => {
      console.log('🧪 [ToastDebugger] Test toast erreur...');
      toast.error('Test toast erreur - Ceci est un test');
    }, 3000);

    // Test 4: Vérifier si ToastContainer existe
    setTimeout(() => {
      const toastContainer = document.querySelector('.Toastify__toast-container');
      console.log('🧪 [ToastDebugger] ToastContainer trouvé:', !!toastContainer);
      
      if (!toastContainer) {
        console.error('❌ [ToastDebugger] ToastContainer non trouvé dans le DOM !');
        console.log('🔍 [ToastDebugger] Éléments avec classe Toastify:', 
          document.querySelectorAll('[class*="Toastify"]'));
      } else {
        console.log('✅ [ToastDebugger] ToastContainer présent dans le DOM');
      }
    }, 4000);

    // Test 5: Vérifier les styles CSS
    setTimeout(() => {
      const toastifyCSS = document.querySelector('link[href*="ReactToastify.css"]') || 
                         document.querySelector('style[data-styled*="toastify"]') ||
                         Array.from(document.styleSheets).find(sheet => {
                           try {
                             return Array.from(sheet.cssRules).some(rule => 
                               rule.selectorText && rule.selectorText.includes('Toastify')
                             );
                           } catch (e) {
                             return false;
                           }
                         });
      
      console.log('🧪 [ToastDebugger] CSS Toastify chargé:', !!toastifyCSS);
      
      if (!toastifyCSS) {
        console.error('❌ [ToastDebugger] CSS ReactToastify non trouvé !');
        console.log('💡 [ToastDebugger] Vérifiez que "react-toastify/dist/ReactToastify.css" est importé');
      }
    }, 5000);

  }, []);

  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      left: '10px',
      background: '#f0f0f0',
      padding: '10px',
      border: '2px solid #007bff',
      borderRadius: '5px',
      zIndex: 9999,
      fontSize: '12px',
      maxWidth: '300px'
    }}>
      <strong>🧪 Toast Debugger</strong>
      <br />
      Vérifiez la console pour les logs de débogage.
      <br />
      <button 
        onClick={() => toast.success('Test manuel réussi !')}
        style={{ marginTop: '5px', padding: '5px 10px' }}
      >
        Test Manuel
      </button>
    </div>
  );
};

export default ToastDebugger;
