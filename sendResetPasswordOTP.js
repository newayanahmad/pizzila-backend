const nodemailer = require('nodemailer')
const sendPasswordResetOTP = async (to, otp, username) => {
    let transport = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.MAIL_USERNAME,
            pass: process.env.MAIL_PASSWORD,
        },
    });

    await transport.sendMail({
        from: process.env.MAIL_USERNAME,
        to: to,
        subject: "Password Reset",
        html: `<body style="font-family: Arial, sans-serif; margin: 0; padding: 0;">
        <div style="background-color: #f4f4f4; padding: 10px;">
            <div style="max-width: 600px; margin: 0 auto;">
                <div style="background-color: #fff; padding: 20px; text-align: center; border-radius: 15px; box-shadow: 0px 0px 10px rgba(0,0,0,0.1);">
                    <h2 style="color: #444; font-size: 24px;">Hello ${username},</h2>
                    <p style="font-size: 16px; color: #666;">
                        We received a request to reset your password at Pizzila 🍕. Please enter the following OTP to proceed:
                    </p>
                    <div style="font-size: 24px; color: #444; padding: 20px; border-radius: 5px; background-color: #f9f9f9; display: inline-block;">
                        ${otp}
                    </div>
                    <p style="font-size: 16px; color: #666;">
                        If you did not request this code, please ignore this email and your password will remain unchanged.
                    </p>
                    <p style="font-size: 16px; color: #666;">
                        Thanks,<br>Pizzila Team
                    </p>
                </div>
            </div>
        </div>
    </body>
    `
    })
}


module.exports = sendPasswordResetOTP