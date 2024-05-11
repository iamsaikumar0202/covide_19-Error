const express = require('express')
const path = require('path')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const dbPath = path.join(__dirname, 'covide19IndiaPortal.db')

const app = express()
app.use(express.json())
let db = null
const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server Running at http://localhost:3000/')
    })
  } catch (e) {
    console.log(`DB Error: ${e.message}`)
    process.exit(1)
  }
}

initializeDBAndServer()

const convertStateDbObToResOb = dbObject => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  }
}

const convertdistricseDbObToResOb = dbObject => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  }
}

const authentToken = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'MY_SECRET_TOKEN', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        next()
      }
    })
  }
}

app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`
  const dbUser = await db.get(selectUserQuery)
  if (dbUser === undefined) {
    response.status(400)
    response.send('Invalid User')
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password)
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      }
      const jwtToken = jwt.sign(payload, 'MY_SECRET_TOKEN')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid Password')
    }
  }
})

app.get('/states/', authentToken, async (request, response) => {
  const getQuery = `
     SELECT *
     FROM state;
    `
  const statesArray = await db.all(getQuery)
  response.send(
    statesArray.map(eachArray => convertStateDbObToResOb(eachArray)),
  )
})

app.get('/states/:stateId/', authentToken, async (request, response) => {
  const {stateId} = request.params
  const getQuery = `
     SELECT *
     FROM state
     WHERE state_id=${stateId};
    `
  const state = await db.get(getQuery)
  response.send(convertStateDbObToResOb(state))
})

app.post('/districts/', authentToken, async (request, response) => {
  const districtDetails = request.body
  const {districtName, stateId, cases, cured, active, deaths} = districtDetails
  const adddistrictQuery = `
    INSERT INTO
      district (district_name, state_id, cases, cured, active, deaths)
    VALUES
      (
        '${districtName}',
         ${stateId},
         ${cases},
         ${cured},
         ${active},
         ${deaths}
         
      );`

  await db.run(adddistrictQuery)

  response.send('District Successfully Added')
})

app.get('/districts/:districtId/', authentToken, async (request, response) => {
  const {districtId} = request.params
  const getQuery = `
     SELECT *
     FROM state
     WHERE district_id=${districtId};
    `
  const district = await db.get(getQuery)
  response.send(convertdistricseDbObToResOb(district))
})

app.get('/districts/:districtId/', authentToken, async (request, response) => {
  const {districtId} = request.params
  const deleteQuery = `
    DELETE FROM 
      district 
    WHERE 
       district_id=${districtId};`
  await db.get(deleteQuery)
  response.send('District Removed')
})

app.put('/districts/:districtId/', authentToken, async (request, response) => {
  const {districtId} = request.params
  const districtDetails = request.body
  const {districtName, stateId, cases, cured, active, deaths} = districtDetails
  const updateBookQuery = `
    UPDATE
      district
    SET
      district_name='${districtName}',
      stater_id=${stateId},
      cases= ${cases},
      cured=${cured},
      active=${active},
      deaths=${deaths}
    WHERE
      district_id = ${districtId};`
  await db.run(updateBookQuery)
  response.send('District Details Updated')
})

app.get('/states/:stateId/stats/', authentToken, async (request, response) => {
  const {stateId} = request.params
  const selectstateQury = `

      SELECT 
        SUM(cases),
        SUM(cured),
        SUM(active),
        SUM(deaths)
      FROM district 
      WHERE 
       state_id=${stateId};
     `
  const states = await db.get(selectstateQury)
  response.send({
    totalCases: states['SUM(cases)'],
    totalCured: states['SUM(cured)'],
    totalActive: states['SUM(active)'],
    totalDeaths: states['SUM(deaths)'],
  })
})

module.exports = app
