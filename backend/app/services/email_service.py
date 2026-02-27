import smtplib
from email.message import EmailMessage
import logging
import asyncio
from datetime import date
from typing import Dict, Any

logger = logging.getLogger(__name__)

class EmailService:
    def _create_html_report(self, data: Dict[str, Any]) -> str:
        """Generate the HTML template for the daily report"""
        
        # Sort models by score
        models = sorted(data["models"], key=lambda k: k["score"], reverse=True)
        date_str = data["date"]
        
        portfolio_value = data.get("portfolio_value", 0.0)
        daily_pnl = data.get("daily_pnl", 0.0)
        daily_pnl_percent = data.get("daily_pnl_percent", 0.0)
        
        overall_pnl_color = "green" if daily_pnl >= 0 else "red"
        overall_pnl_sign = "+" if daily_pnl >= 0 else ""
        
        html = f"""
        <html>
            <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px;">
                <div style="max-width: 600px; margin: auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
                    <h2 style="color: #333; text-align: center;">Daily Performance Report</h2>
                    <p style="text-align: center; color: #666;">Trades and AI model performance for {date_str}</p>
                    
                    <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0; border: 1px solid #e0e0e0;">
                        <h3 style="margin: 0; color: #555; font-size: 16px; text-transform: uppercase;">Total Portfolio Value</h3>
                        <p style="font-size: 32px; font-weight: bold; margin: 10px 0; color: #1976d2;">${portfolio_value:,.2f}</p>
                        <p style="margin: 0; font-size: 16px; font-weight: bold; color: {overall_pnl_color};">
                            {overall_pnl_sign}${abs(daily_pnl):,.2f} ({overall_pnl_sign}{daily_pnl_percent:.2f}%) Today
                        </p>
                    </div>
                    
                    <h3 style="border-bottom: 2px solid #1976d2; padding-bottom: 5px; color: #1976d2;">AI Model Leaderboard</h3>
        """
        
        colors = {"OPENAI": "#1976d2", "GEMINI": "#9c27b0", "ANTHROPIC": "#ed6c02"}
        medals = ["🥇 1st Place", "🥈 2nd Place", "🥉 3rd Place"]
        
        for idx, model in enumerate(models):
            if model["score"] == 0 and model["total_positions"] == 0:
                continue
                
            color = colors.get(model["provider"], "#757575")
            medal = medals[idx] if idx < len(medals) else ""
            
            pnl_color = "green" if model["open_pnl"] >= 0 else "red"
            
            html += f"""
                    <div style="border-left: 4px solid {color}; padding: 10px; margin-bottom: 15px; background-color: #fafafa;">
                        <h4 style="margin: 0; color: {color};">{model["provider"]} <span style="font-size: 12px; color: #333;">{medal}</span></h4>
                        <p style="font-size: 24px; font-weight: bold; margin: 5px 0;">{model['score']} <span style="font-size: 14px; color: #666; font-weight: normal;">pts</span></p>
                        <table style="width: 100%; font-size: 14px; color: #555;">
                            <tr>
                                <td><strong>Open PnL:</strong> <span style="color: {pnl_color};">${model['open_pnl']:.2f}</span></td>
                                <td><strong>Win Rate:</strong> {model['win_rate']:.1f}%</td>
                            </tr>
                            <tr>
                                <td><strong>Trades Today:</strong> {model['trades_today']}</td>
                                <td><strong>Active Pos:</strong> {model['total_positions']}</td>
                            </tr>
                        </table>
                    </div>
            """
            
        html += """
                    <h3 style="border-bottom: 2px solid #1976d2; padding-bottom: 5px; color: #1976d2; margin-top: 30px;">Today's Trades</h3>
                    <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left;">
                        <thead>
                            <tr style="background-color: #eee;">
                                <th style="padding: 8px; border-bottom: 1px solid #ddd;">Symbol</th>
                                <th style="padding: 8px; border-bottom: 1px solid #ddd;">Action</th>
                                <th style="padding: 8px; border-bottom: 1px solid #ddd;">Qty</th>
                                <th style="padding: 8px; border-bottom: 1px solid #ddd;">Price</th>
                                <th style="padding: 8px; border-bottom: 1px solid #ddd;">Total</th>
                                <th style="padding: 8px; border-bottom: 1px solid #ddd;">AI</th>
                            </tr>
                        </thead>
                        <tbody>
        """
        
        trades = data["trades"]
        if not trades:
            html += """<tr><td colspan="6" style="padding: 10px; text-align: center; color: #888;">No trades executed today.</td></tr>"""
        else:
            for trade in trades:
                provider = trade.ai_provider or "OPENAI"
                color = colors.get(provider, "#757575")
                action_color = "green" if trade.action.value == "BUY" else "red"
                
                html += f"""
                            <tr>
                                <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">{trade.symbol}</td>
                                <td style="padding: 8px; border-bottom: 1px solid #eee; color: {action_color}; font-weight: bold;">{trade.action.value}</td>
                                <td style="padding: 8px; border-bottom: 1px solid #eee;">{trade.quantity}</td>
                                <td style="padding: 8px; border-bottom: 1px solid #eee;">${trade.price:.2f}</td>
                                <td style="padding: 8px; border-bottom: 1px solid #eee;">${trade.total_amount:.2f}</td>
                                <td style="padding: 8px; border-bottom: 1px solid #eee;">
                                    <span style="background-color: {color}; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px;">{provider}</span>
                                </td>
                            </tr>
                """
                
        html += """
                        </tbody>
                    </table>
                    <p style="text-align: center; font-size: 12px; color: #aaa; margin-top: 30px;">Generated automatically by StockBot.</p>
                </div>
            </body>
        </html>
        """
        return html

    def _sync_send_email(self, config, data: Dict[str, Any]) -> bool:
        """Synchronously send the email over SMTP"""
        if not config.smtp_email or not config.smtp_password:
            logger.warning("SMTP Config missing. Cannot send daily report.")
            return False
            
        try:
            msg = EmailMessage()
            msg["Subject"] = f"StockBot: Daily Performance Report - {data['date']}"
            msg["From"] = config.smtp_email
            msg["To"] = config.smtp_email  # Sending to the provided config email
            
            html_content = self._create_html_report(data)
            msg.set_content("Please enable HTML viewing to see the Daily Report.")
            msg.add_alternative(html_content, subtype='html')
            
            
            # Clean up credentials (users often copy-paste with spaces)
            safe_email = config.smtp_email.strip()
            safe_password = config.smtp_password.replace('\xa0', '').replace(' ', '').strip()
            
            # Using Gmail SMTP settings as default for now based on user's gmail address request
            with smtplib.SMTP_SSL("smtp.gmail.com", 465) as smtp:
                smtp.login(safe_email, safe_password)
                smtp.send_message(msg)
                
            logger.info(f"Successfully sent daily report to {config.smtp_email}")
            return True
        except Exception as e:
            logger.error(f"Failed to send email: {e}")
            return False

    async def send_daily_report(self, db_session) -> bool:
        """Asynchronously formats and sends the daily report"""
        from app.models.models import BotConfig
        from app.services.portfolio_service import portfolio_service
        
        config = db_session.query(BotConfig).first()
        if not config or not config.smtp_email or not config.smtp_password:
            return False
            
        data = portfolio_service.get_daily_report_data(db_session)
        
        # Execute the blocking SMTP logic in a separate thread
        return await asyncio.to_thread(self._sync_send_email, config, data)

email_service = EmailService()
