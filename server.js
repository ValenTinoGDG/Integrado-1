import webServer from './web-server/web-server.js';     // Importamos el servidor web
import wsReceiver from './web-server/ws-receiver.js';   // Importamos el receptor de transmisión
import startNgrok from './web-server/ngrok.js';         // Esto es para tunelizar ya que no tengo ip fija pero la version gratuita tiene una cuota y me he pasado

const { server, port } = webServer();   // Obtengo el servidor web y su puerto
wsReceiver(server);                     // Le paso el servidor web al receptor de transmisiones (es para que usen el mismo puerto porque ngrok solo permitia uno sin pagar)

//startNgrok();   // Inicia la tunelización con ngrok (me he pasado de cuota)

// Iniciamos el servidor
server.listen(port, () => {
    console.log(`Servidor escuchando en el puerto ${port}`);
});