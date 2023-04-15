const amqp = require('amqplib');
const { Client } = require('pg');

const client = new Client({
  user: 'postgres',
  host: 'db',
  database: 'productsBT',
  password: 'mysecretpassword',
  port: 5432, // The default PostgreSQL port
});

async function main() {

  // Connect to the database
  client.connect((err) => {
    if (err) {
      console.error('Error connecting to PostgreSQL database:', err.stack);
    } else {
      console.log('Connected to PostgreSQL database');
    }
  });

  client.query(`CREATE TABLE IF NOT EXISTS Products ( id SERIAL PRIMARY KEY, sku VARCHAR(255) NOT NULL, designation TEXT NOT NULL, description TEXT NOT NULL)`, (err, res) => {
    if (err) {
      console.error('Error performing query:', err.stack);
    } else {
      console.log('Query result:', res.rows);
      client.query(`SELECT x.* FROM public.products x
      WHERE sku = 'k485b1l47h5b'`, (err, res) => {
        if (err) {
          console.error('Error performing query:', err.stack);
        }
        else {
          console.log('Query result:', res.rows);
          if (res.rowCount == 0) {
            client.query(`INSERT INTO Products (sku, designation, description) VALUES 
              ('k485b1l47h5b', 'Placa Gráfica Gigabyte GeForce RTX 2060 D6 6G', 'placa mais accessivel e decente'),
              ('c475e9l47f5b', 'Cooler CPU Nox H-224 ARGB', 'arrefecedor com luzinhas'),
              ('n385j1l17h8s', 'Cooler CPU Noctua NH-D15 Chromax Black', 'arrefecedor sem luzinhas'),
              ('z205bgi47hoc', 'Rato Óptico Logitech Pro X Superlight Wireless 25400DPI ', 'rato com nome de pessoa'),
              ('h274h5l4563b', 'Rato Óptico Razer DeathAdder Essential 2021 6400DPI', 'rato da marca das cobrinhas'),
              ('b523h5l487kl', 'Portátil Lenovo Legion 5 15.6" 15ACH6', 'portatil todo fancy'),
              ('x258f5l48475', 'Portátil MSI Raider GE76 12UH-007XPT', 'portatil com luzinhas'),
              ('t364gju78354', 'Portátil MSI Stealth GS66 12UGS-009PT', 'Protatil pra quem pode'),
              ('c6348gn840j1', 'Computador Desktop MSI MAG Infinite S3 11SH-208XIB', 'desktop para o proximo feromonas'),
              ('q73f947gn681', 'Teclado Mecânico Razer Blackwidow V3 PT Tenkeyless RGB Yellow Switch', 'teclado cheio de cores mecanico'),
              ('pa23fvh509a1', 'Cartão Microsoft Office 2021 Casa e Estudantes 1 PC/MAC', 'autentico roubo'),
              ('d63h57d738s1', 'Seat Arona', 'La maquina de fiesta')`,
              (err, res) => {
                if (err) {
                  console.error('Error performing query:', err.stack);
                } else {
                  console.log('Query result:', res.rows);
                }
              })
          }
        }
      })


    }
  })
  createQueueAndListener();
  createRPCQueueAndListener();
}

async function createRPCQueueAndListener() {
  try {
    // Connect to RabbitMQ server
    const connection = await amqp.connect('amqp://rabbitmq');
    // Create a channel
    const channel = await connection.createChannel();
    // Set up a queue to receive messages
    const queue = 'rpc_products_queue';

    await channel.assertQueue(queue, { durable: true });
    channel.bindQueue(queue, "rpc_products_exchange", "");
    channel.prefetch(1);
    console.log('Waiting for RPC requests...');

    channel.consume(queue, async function (msg) {
      console.log('Received RPC request');
      // Get all products from the database
      client.query('SELECT sku, designation, description FROM Products', (err, res) => {
        if (err) {
          console.error('Error performing query:', err.stack);
        } else {
          console.log('Query result:', res.rows);
          const payload = JSON.stringify(res.rows);
          // Send the response to the RPC client
          channel.sendToQueue(msg.properties.replyTo,
            Buffer.from(payload), {
              correlationId: msg.properties.correlationId
            });
        }});

      channel.ack(msg);
    })
  } catch (error) {
    console.error(error);
  }
}

async function createQueueAndListener() {
  try {
    // Connect to RabbitMQ server
    const connection = await amqp.connect('amqp://rabbitmq');
    // Create a channel
    const channel = await connection.createChannel();
    
    // Create a queue
    const queueName = 'products_bootstraper_queue';
    await channel.assertQueue(queueName);
    channel.bindQueue(queueName, "fanout_exchange", "");
    // Set up a listener to consume messages from the queue
    channel.consume(queueName, (msg) => {
      console.log(`Received message: ${msg.content.toString()}`);
      const product = JSON.parse(msg.content);
      console.log(product.sku);
      switch (msg.properties.headers.action) {
        case 'product-created':
          client.query(`INSERT INTO Products (sku, designation, description) 
          VALUES('${product.sku}', '${product.designation}', '${product.description}')`,
            (err, res) => {
              if (err) {
                console.error('Error performing query:', err.stack);
              } else {
                console.log('Query result:', res.rows);
              }
            });
            break;
        case 'product-updated':
          client.query(`UPDATE Products
          SET designation='${product.designation}', description='${product.description}'
          WHERE sku='${product.sku}';
          `,
            (err, res) => {
              if (err) {
                console.error('Error performing query:', err.stack);
              } else {
                console.log('Query result:', res.rows);
              }
            });
            break;

        case 'product-deleted':
          client.query(`DELETE FROM Products
          WHERE sku='${product.sku}';
          `,
            (err, res) => {
              if (err) {
                console.error('Error performing query:', err.stack);
              } else {
                console.log('Query result:', res.rows);
              }
            });
            break;
        default:
          break;
      }

      // Acknowledge that the message has been processed
      channel.ack(msg);
    });

    console.log(`Listening for messages on queue ${queueName}...`);
  } catch (error) {
    console.error(error);
  }
}



main().catch(console.error);