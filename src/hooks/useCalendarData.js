import { useState, useCallback, useRef } from 'react'
import {
  appointmentService,
  patientService,
  userService,
} from '../lib/services'
import { specialtyService } from '../lib/services/specialtyService'

const derivePatientsFromAppointments = (appointments) => {
  const byId = new Map()
  for (const apt of appointments || []) {
    if (!apt?.patient_id || !apt?.patient) continue
    if (!byId.has(apt.patient_id)) {
      byId.set(apt.patient_id, {
        id: apt.patient_id,
        nom: apt.patient.nom,
        prenom: apt.patient.prenom,
        telephone: apt.patient.telephone,
      })
    }
  }
  return Array.from(byId.values())
}

export const useCalendarData = (currentUser, options = {}) => {
  const { scopedDoctorId = null, userRole = null } = options
  const [loading, setLoading] = useState(true)
  const [appointments, setAppointments] = useState([])
  const [patients, setPatients] = useState([])
  const [medecins, setMedecins] = useState([])
  const [specialites, setSpecialites] = useState([])
  const currentUserRef = useRef(currentUser)
  const scopedDoctorIdRef = useRef(scopedDoctorId)
  const userRoleRef = useRef(userRole)
  const initialLoadDone = useRef(false)
  currentUserRef.current = currentUser
  scopedDoctorIdRef.current = scopedDoctorId
  userRoleRef.current = userRole

  const loadData = useCallback(async () => {
    const user = currentUserRef.current
    if (!user) return

    const doctorId = scopedDoctorIdRef.current

    try {
      if (!initialLoadDone.current) {
        setLoading(true)
      }

      const ignoreSpecialityForSecretary = userRoleRef.current === 'secretary'

      if (doctorId) {
        const [appointmentsData, medecinData, specialitesData] =
          await Promise.all([
            appointmentService.getByDoctor(doctorId),
            userService.getById(doctorId),
            specialtyService.getAll(),
          ])

        const appointmentsList = appointmentsData || []
        setAppointments(appointmentsList)
        setPatients(derivePatientsFromAppointments(appointmentsList))
        setMedecins(medecinData ? [medecinData] : [])
        setSpecialites(specialitesData || [])
      } else {
        const [appointmentsData, patientsData, medecinsData, specialitesData] =
          await Promise.all([
            appointmentService.getAll({
              ignoreSpecialityFilter: ignoreSpecialityForSecretary,
            }),
            patientService.getAll(),
            userService.getDoctors({
              ignoreSpecialityFilter: ignoreSpecialityForSecretary,
              select: '*, couleur' // Inclure le champ couleur
            }),
            specialtyService.getAll(),
          ])
        setAppointments(appointmentsData || [])
        setPatients(patientsData || [])
        setMedecins(medecinsData || [])
        setSpecialites(specialitesData || [])
      }

      initialLoadDone.current = true
    } catch (error) {
      console.error('Erreur lors du chargement du calendrier:', error)
      setAppointments([])
      setPatients([])
      setMedecins([])
      setSpecialites([])
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    loading,
    appointments,
    patients,
    medecins,
    specialites,
    loadData,
    setAppointments,
    setMedecins,
    setPatients,
    setSpecialites,
  }
}
