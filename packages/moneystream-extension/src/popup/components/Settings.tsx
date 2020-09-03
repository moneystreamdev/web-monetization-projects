import React from 'react'
import { Grid } from '@material-ui/core'

import { PopupProps } from '../types'

import Switch from '@material-ui/core/Switch'
import { StatusTypography } from './util/StatusTypography'

export const SettingsPage = (props: PopupProps) => {
    const [state, setState] = React.useState({
        checkedCutOff: true
      })
    const {
    context: {
      runtime: { tabOpener }
    }
  } = props
  const onClick = tabOpener(`https://moneystreamdev.github.io/moneystream-project/`)
  const handleChange = (event:any) => {
    setState({ ...state, [event.target.name]: event.target.checked })
  }
  return (
    <Grid container justify='center' alignItems='center'>
      <div>
        <StatusTypography variant='h6' align='center'>
          Settings
        </StatusTypography>
        <StatusTypography variant='subtitle1' align='center'>
            MoneyStream switch
            <Switch
            checked={state.checkedCutOff}
            onChange={handleChange}
            name="checkedCutOff"
            inputProps={{ 'aria-label': 'primary checkbox' }}
            />
        </StatusTypography>
      </div>
    </Grid>
  )
}
