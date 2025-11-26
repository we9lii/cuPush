const mysql = require('mysql2');

const connection = mysql.createConnection({
    host: '192.185.24.186',
    user: 'qssunsol_Faisal',
    password: '7ClWgjcQ,S_{a*Jq',
    database: 'qssunsolar_cu',
    port: 3306
});

console.log('Attempting to connect with qssunsol_Faisal...');

connection.connect((err) => {
    if (err) {
        console.error('Connection Failed!');
        console.error('Error Code:', err.code);
        console.error('Error Message:', err.message);
        process.exit(1);
    }
    console.log('SUCCESS! Connected to database.');
    connection.end();
});
