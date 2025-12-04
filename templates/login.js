document.addEventListener('DOMContentLoaded', () => {
    const webauthnSection = document.getElementById('webauthn-login-section');
    const webauthnLoginBtn = document.getElementById('btn-webauthn-login');

    // --- Funciones auxiliares para WebAuthn ---
    // Estas funciones convierten entre ArrayBuffer y Base64URL, formato necesario para WebAuthn
    function bufferDecode(value) {
        return Uint8Array.from(atob(value.replace(/_/g, '/').replace(/-/g, '+')), c => c.charCodeAt(0));
    }

    function bufferEncode(value) {
        return btoa(String.fromCharCode.apply(null, new Uint8Array(value)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
    }

    // 1. Comprobar si el navegador es compatible con WebAuthn
    if (window.PublicKeyCredential) {
        webauthnSection.style.display = 'block';
    }

    // 2. Manejar el clic en el botón de login biométrico
    webauthnLoginBtn.addEventListener('click', async () => {
        try {
            // Paso 1: Pedir el "desafío" (challenge) al servidor
            const respBegin = await fetch('/api/webauthn/login-begin', { method: 'POST' });
            let options = await respBegin.json();

            if (options.error) {
                return alert(options.error);
            }

            // Convertimos los campos necesarios de Base64URL a ArrayBuffer
            options.challenge = bufferDecode(options.challenge);
            options.allowCredentials.forEach(cred => {
                cred.id = bufferDecode(cred.id);
            });

            // Paso 2: Pedir al navegador que firme el desafío con la biometría
            const assertion = await navigator.credentials.get({ publicKey: options });

            // Convertimos la respuesta para poder enviarla como JSON
            const assertionJSON = {
                id: assertion.id,
                rawId: bufferEncode(assertion.rawId),
                response: {
                    authenticatorData: bufferEncode(assertion.response.authenticatorData),
                    clientDataJSON: bufferEncode(assertion.response.clientDataJSON),
                    signature: bufferEncode(assertion.response.signature),
                    userHandle: assertion.response.userHandle ? bufferEncode(assertion.response.userHandle) : null,
                },
                type: assertion.type,
            };

            // Paso 3: Enviar la respuesta firmada al servidor para su verificación
            const respComplete = await fetch('/api/webauthn/login-complete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(assertionJSON),
            });

            const verification = await respComplete.json();
            if (verification.verified) {
                window.location.href = "/"; // ¡Éxito! Redirigir al panel principal
            } else {
                alert(`Error de autenticación: ${verification.error}`);
            }
        } catch (err) {
            console.error("Error durante el login biométrico:", err);
            alert("No se pudo completar el inicio de sesión biométrico. " + err.message);
        }
    });
});