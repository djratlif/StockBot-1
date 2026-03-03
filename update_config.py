import sys

file_path = "frontend/src/pages/Configuration.tsx"
with open(file_path, "r") as f:
    content = f.read()

# Replace state definition
content = content.replace("  const [loading, setLoading] = useState(true);\n  const [error, setError] = useState<string | null>(null);",
"""  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingSections, setSavingSections] = useState<Record<string, boolean>>({});""")

# Insert handleSaveSection
save_field_code = """  const saveField = async (field: keyof BotConfig, value: any) => {
    if (!config) return;
    try {
      const updated = await botAPI.updateBotConfig({ [field]: value });
      setConfig(updated);
    } catch (err) {
      setError(`Failed to update ${field}`);
      console.error('Save error:', err);
    }
  };"""

save_section_code = """  const saveField = async (field: keyof BotConfig, value: any) => {
    if (!config) return;
    try {
      const updated = await botAPI.updateBotConfig({ [field]: value });
      setConfig(updated);
    } catch (err) {
      setError(`Failed to update ${field}`);
      console.error('Save error:', err);
    }
  };

  const handleSaveSection = async (sectionName: string, fields: (keyof BotConfig)[]) => {
    if (!config) return;
    setSavingSections(prev => ({ ...prev, [sectionName]: true }));
    try {
      const partialConfig: Partial<BotConfig> = {};
      fields.forEach(f => {
        (partialConfig as any)[f] = config[f];
      });
      const updated = await botAPI.updateBotConfig(partialConfig);
      setConfig(updated);
    } catch (err) {
      setError(`Failed to save ${sectionName}`);
      console.error('Save error:', err);
    } finally {
      setTimeout(() => {
        setSavingSections(prev => ({ ...prev, [sectionName]: false }));
      }, 500);
    }
  };"""
content = content.replace(save_field_code, save_section_code)

# Replace OpenAI
content = content.replace("""                        onClick={() => {
                          const active = !config.openai_active;
                          handleChange('openai_active', active);
                          saveField('openai_active', active);
                        }}""",
"""                        onClick={() => {
                          handleChange('openai_active', !config.openai_active);
                        }}""")

content = content.replace("""                        onChange={(e, val) => handleChange('openai_allocation', val as number)}
                        onChangeCommitted={(e, val) => saveField('openai_allocation', val as number)}""",
"""                        onChange={(e, val) => handleChange('openai_allocation', val as number)}""")

# Replace Gemini
content = content.replace("""                        onClick={() => {
                          const active = !config.gemini_active;
                          handleChange('gemini_active', active);
                          saveField('gemini_active', active);
                        }}""",
"""                        onClick={() => {
                          handleChange('gemini_active', !config.gemini_active);
                        }}""")

content = content.replace("""                        onChange={(e, val) => handleChange('gemini_allocation', val as number)}
                        onChangeCommitted={(e, val) => saveField('gemini_allocation', val as number)}""",
"""                        onChange={(e, val) => handleChange('gemini_allocation', val as number)}""")

# Replace Anthropic
content = content.replace("""                        onClick={() => {
                          const active = !config.anthropic_active;
                          handleChange('anthropic_active', active);
                          saveField('anthropic_active', active);
                        }}""",
"""                        onClick={() => {
                          handleChange('anthropic_active', !config.anthropic_active);
                        }}""")

content = content.replace("""                        onChange={(e, val) => handleChange('anthropic_allocation', val as number)}
                        onChangeCommitted={(e, val) => saveField('anthropic_allocation', val as number)}""",
"""                        onChange={(e, val) => handleChange('anthropic_allocation', val as number)}""")

# Add AI Save Button
content = content.replace("""                  </Box>
                </Grid>

              </Grid>""",
"""                  </Box>
                </Grid>

                <Grid item xs={12}>
                  <Box display="flex" justifyContent="flex-end">
                    <Button 
                      variant="contained" 
                      color="primary" 
                      disabled={savingSections['ai']} 
                      onClick={() => handleSaveSection('ai', ['openai_active', 'openai_allocation', 'gemini_active', 'gemini_allocation', 'anthropic_active', 'anthropic_allocation'])}
                      startIcon={savingSections['ai'] ? <CircularProgress size={20} /> : undefined}
                    >
                      {savingSections['ai'] ? 'Saving...' : 'Save AI Allocations'}
                    </Button>
                  </Box>
                </Grid>

              </Grid>""")

# Replace Strategy Profile Select
content = content.replace("""                      onChange={(e) => {
                        handleChange('strategy_profile', e.target.value);
                        saveField('strategy_profile', e.target.value);
                      }}""",
"""                      onChange={(e) => {
                        handleChange('strategy_profile', e.target.value);
                      }}""")

# Replace Risk Tolerance Select
content = content.replace("""                      onChange={(e) => {
                        handleChange('risk_tolerance', e.target.value);
                        saveField('risk_tolerance', e.target.value);
                      }}""",
"""                      onChange={(e) => {
                        handleChange('risk_tolerance', e.target.value);
                      }}""")

# Replace Max Daily Trades
content = content.replace("""                    onChange={(e) => handleChange('max_daily_trades', parseInt(e.target.value))}
                    onBlur={(e) => saveField('max_daily_trades', parseInt(e.target.value))}""",
"""                    onChange={(e) => handleChange('max_daily_trades', parseInt(e.target.value))}""")

# Replace Minimum Cash Reserve
content = content.replace("""                    onChange={(e) => handleChange('min_cash_reserve', parseFloat(e.target.value))}
                    onBlur={(e) => saveField('min_cash_reserve', parseFloat(e.target.value))}""",
"""                    onChange={(e) => handleChange('min_cash_reserve', parseFloat(e.target.value))}""")

# Add Save Strategy Button
content = content.replace("""                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Schedule Card */}""",
"""                  />
                </Grid>
                <Grid item xs={12}>
                  <Box display="flex" justifyContent="flex-end">
                    <Button 
                      variant="contained" 
                      color="primary" 
                      disabled={savingSections['strategy']} 
                      onClick={() => handleSaveSection('strategy', ['strategy_profile', 'risk_tolerance', 'max_daily_trades', 'min_cash_reserve'])}
                      startIcon={savingSections['strategy'] ? <CircularProgress size={20} /> : undefined}
                    >
                      {savingSections['strategy'] ? 'Saving...' : 'Save Strategy'}
                    </Button>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Schedule Card */}""")

# Replace Session Start
content = content.replace("""                    onChange={(e) => {
                      handleChange('trading_hours_start', e.target.value);
                      saveField('trading_hours_start', e.target.value);
                    }}""",
"""                    onChange={(e) => {
                      handleChange('trading_hours_start', e.target.value);
                    }}""")

# Replace Session End
content = content.replace("""                    onChange={(e) => {
                      handleChange('trading_hours_end', e.target.value);
                      saveField('trading_hours_end', e.target.value);
                    }}""",
"""                    onChange={(e) => {
                      handleChange('trading_hours_end', e.target.value);
                    }}""")

# Add Save Schedule Button
content = content.replace("""                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>""",
"""                  />
                </Grid>
                <Grid item xs={12}>
                  <Box display="flex" justifyContent="flex-end">
                    <Button 
                      variant="contained" 
                      color="primary" 
                      disabled={savingSections['schedule']} 
                      onClick={() => handleSaveSection('schedule', ['trading_hours_start', 'trading_hours_end'])}
                      startIcon={savingSections['schedule'] ? <CircularProgress size={20} /> : undefined}
                    >
                      {savingSections['schedule'] ? 'Saving...' : 'Save Schedule'}
                    </Button>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>""")

# Replace Max Position Size
content = content.replace("""                  onChange={(e, val) => handleChange('max_position_size', (val as number) / 100)}
                  onChangeCommitted={(e, val) => saveField('max_position_size', (val as number) / 100)}""",
"""                  onChange={(e, val) => handleChange('max_position_size', (val as number) / 100)}""")

# Replace Take Profit Percentage
content = content.replace("""                  onChange={(e, val) => handleChange('take_profit_percentage', (val as number) / 100)}
                  onChangeCommitted={(e, val) => saveField('take_profit_percentage', (val as number) / 100)}""",
"""                  onChange={(e, val) => handleChange('take_profit_percentage', (val as number) / 100)}""")

# Replace Stop Loss Percentage
content = content.replace("""                  onChange={(e, val) => handleChange('stop_loss_percentage', (val as number) / 100)}
                  onChangeCommitted={(e, val) => saveField('stop_loss_percentage', (val as number) / 100)}""",
"""                  onChange={(e, val) => handleChange('stop_loss_percentage', (val as number) / 100)}""")

# Add Save Limits Button
content = content.replace("""                />
                <Typography variant="caption" color="textSecondary">
                  Automatically liquidate a holding to stop bleeding at this %.
                </Typography>
              </Box>

            </CardContent>""",
"""                />
                <Typography variant="caption" color="textSecondary">
                  Automatically liquidate a holding to stop bleeding at this %.
                </Typography>
              </Box>

              <Box mt={2} display="flex" justifyContent="flex-end">
                <Button 
                  variant="contained" 
                  color="primary" 
                  disabled={savingSections['limits']} 
                  onClick={() => handleSaveSection('limits', ['max_position_size', 'take_profit_percentage', 'stop_loss_percentage'])}
                  startIcon={savingSections['limits'] ? <CircularProgress size={20} /> : undefined}
                >
                  {savingSections['limits'] ? 'Saving...' : 'Save Limits'}
                </Button>
              </Box>

            </CardContent>""")

with open(file_path, "w") as f:
    f.write(content)

print("Replaced Configuration.tsx content successfully")
