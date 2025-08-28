import nodemailer from 'nodemailer';

export interface EmailProvider {
  sendEmail(
    to: string[],
    subject: string,
    content: string,
    isHtml?: boolean,
  ): Promise<boolean>;
}

export class NodeMailerEmailProvider implements EmailProvider {
  private transporter: nodemailer.Transporter;
  constructor() {
    this.transporter = nodemailer.createTransport({
      //port: Number(process.env.SMTP_PORT) || 465,
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.Mailer_Port) || 465,
      secure: true, // true if port is 465
      auth: {
        user: process.env.Mailer_UserName, // e.g. SES SMTP username
        pass: process.env.Mailer_Password, // e.g. SES SMTP password
      },
    });
  }

  async sendEmail(
    to: string[],
    subject: string,
    content: string,
    isHtml: boolean = true,
  ): Promise<boolean> {
    try {
      console.log(to, 'send to users....');
      const mailOptions = {
        from: process.env.EMAIL_FROM || 'akshaysutarwebsite@gmail.com', // verified SES email
        // from: 'akshaysutarwebsite@gmail.com', // verified SES email

        to: to.join(','),
        subject,
        [isHtml ? 'html' : 'text']: content,
      };

      const info = await this.transporter.sendMail(mailOptions);

      console.log('Email sent:', info.messageId);
      return info;
    } catch (error) {
      console.error('Error sending email:', error);
      return false;
    }
  }
}
