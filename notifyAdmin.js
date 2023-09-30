const nodemailer = require('nodemailer');

const notifyAdmin = async (items) => {
    let transport = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.MAIL_USERNAME,
            pass: process.env.MAIL_PASSWORD,
        },
    });

    let itemsList = items.map(item => `<tr><td style="border: 1px solid #ddd; padding: 8px;">${item.ingredient}</td><td style="border: 1px solid #ddd; padding: 8px;">${item.quantity}</td></tr>`).join("");

    await transport.sendMail({
        from: process.env.MAIL_USERNAME,
        to: process.env.MAIL_USERNAME, // send to admin
        subject: "Inventory Alert",
        html: `<body style="font-family: Arial, sans-serif; margin: 0; padding: 0;">
        <div style="background-color: #f4f4f4; padding: 10px;">
            <div style="max-width: 600px; margin: 0 auto;">
                <div style="background-color: #fff; padding: 20px; text-align: center; border-radius: 15px; box-shadow: 0px 0px 10px rgba(0,0,0,0.1);">
                    <h2 style="color: #444; font-size: 24px;">Inventory Alert 🚨</h2>
                    <p style="font-size: 16px; color: #666;">
                        The following items have fallen below the threshold:
                    </p>
                    <table style="font-size: 16px; color: #444; padding: 20px; border-radius: 5px; background-color: #f9f9f9; text-align: left; width: 100%; border-collapse: collapse;">
                        <tr>
                            <th style="border: 1px solid #ddd; padding: 8px;">Item</th>
                            <th style="border: 1px solid #ddd; padding: 8px;">Quantity</th>
                        </tr>
                        ${itemsList}
                    </table>
                    <p style="font-size: 16px; color: #666;">
                        Please restock these items as soon as possible.
                    </p>
                    <p style="font-size: 16px; color: #666;">
                        Thanks,<br>Inventory Management System
                    </p>
                </div>
            </div>
        </div>
    </body>`
    })
}

module.exports = notifyAdmin;
