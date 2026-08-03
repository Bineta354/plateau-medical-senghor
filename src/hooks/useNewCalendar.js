import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { appointmentService } from '../lib/services'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { getIsoString, clampDuration } from '../utils/date'
import {
  hashSpecialtyToColor,
  darkenHexColor,
  getDoctorCalendarColor,
} from '../utils/colors'
import { useCalendarData } from './useCalendarData'
import { useCalendarSearch } from './useCalendarSearch'
import {
  getHidePastAppointmentsPreference,
  setHidePastAppointmentsPreference,
  shouldHidePastAppointment,
} from '../utils/appointmentDisplay'

const DEFAULT_APPOINTMENT_DURATION = 30
const MAX_SELECTION_MINUTES = 120
const RESOURCE_COLUMN_MIN_WIDTH = 190
const RESOURCE_AREA_WIDTH = 150
const MAX_RESOURCE_COLUMNS_NO_SCROLL = 4

const getEventColor = (
  statut,
  priorite,
  specialiteNom,
  specialtyColorMap = {},
  { colorByDoctor = false, doctorColor = null } = {},
) => {
  const normalizedSpecialty = specialiteNom?.trim() ?? ''
  const specialtyColor =
    (normalizedSpecialty && specialtyColorMap[normalizedSpecialty]) ||
    (normalizedSpecialty ? hashSpecialtyToColor(normalizedSpecialty) : null)

  const baseColor =
    colorByDoctor && doctorColor
      ? doctorColor
      : specialtyColor ?? '#3b82f6'

  if (statut === 'annule') return '#6b7280'
  if (priorite === 'tres_urgente') return '#dc2626'
  if (priorite === 'urgente') return darkenHexColor(baseColor, 0.25)

  return baseColor
}

const getEventClassNames = (duree) => {
  if (duree <= 20) return ['gc-duration-short']
  if (duree >= 60) return ['gc-duration-long']
  return ['gc-duration-standard']
}

const buildStats = (appointments) => {
  const today = new Date().toISOString().split('T')[0]
  const total = appointments.length
  const todayCount = appointments.filter((apt) =>
    apt.date_heure?.startsWith(today),
  ).length
  const urgentCount = appointments.filter(
    (apt) => apt.priorite === 'urgente' || apt.priorite === 'tres_urgente',
  ).length

  return [
    {
      label: 'Total RDV',
      value: total,
      icon: null, // Placeholder for now
      color: 'from-blue-500 to-cyan-400',
    },
    {
      label: "Aujourd'hui",
      value: todayCount,
      icon: null, // Placeholder for now
      color: 'from-violet-500 to-purple-400',
    },
    {
      label: 'Urgences',
      value: urgentCount,
      icon: null, // Placeholder for now
      color: 'from-red-500 to-rose-500',
    },
  ]
}

const getFullCalendarDayView = (disableDoctorFilter) =>
  disableDoctorFilter ? 'timeGridDay' : 'resourceTimeGridDay'

export const resolveFullCalendarView = (calendarView, disableDoctorFilter) => {
  if (calendarView === 'timeGridDay') {
    return getFullCalendarDayView(disableDoctorFilter)
  }
  return calendarView
}

const isDateInRange = (date, start, end) => {
  const time = date.getTime()
  return time >= start.getTime() && time < end.getTime()
}

export const useNewCalendar = ({
  initialView = 'timeGridWeek',
  selectedDoctorFilter = 'all',
  disableDoctorFilter = false,
}) => {
  const { currentUser, userProfile } = useAuth()

  // currentUser (l'objet auth Supabase) n'a jamais de champ .role direct :
  // le rôle réel vient de userProfile.role ou de currentUser.profile.role.
  const userRole =
    currentUser?.profile?.role ||
    userProfile?.role ||
    currentUser?.user_metadata?.role ||
    currentUser?.app_metadata?.role

  const scopedDoctorId =
    disableDoctorFilter &&
    selectedDoctorFilter &&
    selectedDoctorFilter !== 'all'
      ? selectedDoctorFilter
      : null

  const {
    loading,
    appointments,
    patients,
    medecins,
    specialites,
    loadData,
    setAppointments,
  } = useCalendarData(currentUser, { scopedDoctorId, userRole })
  const {
    searchTerm,
    setSearchTerm,
    searchResults,
    setSearchResults,
    showSearchDropdown,
    setShowSearchDropdown,
    selectedSearchResult,
    setSelectedSearchResult,
    searchPatientsAndMotifs,
    clearSearch,
  } = useCalendarSearch(appointments, patients, scopedDoctorId)

  const calendarRef = useRef(null)

  const [calendarView, setCalendarView] = useState(initialView)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [showAppointmentModal, setShowAppointmentModal] = useState(false)
  const [modalInitialDate, setModalInitialDate] = useState(new Date())
  const [modalInitialDuration, setModalInitialDuration] = useState(
    DEFAULT_APPOINTMENT_DURATION,
  )
  const [modalInitialDoctorId, setModalInitialDoctorId] = useState('')
  const [modalInitialPatientId, setModalInitialPatientId] = useState('')
  const [modalInitialSpecialty, setModalInitialSpecialty] = useState('')
  const [editingAppointment, setEditingAppointment] = useState(null)
  const [animatedStats, setAnimatedStats] = useState(false)
  const [selectedSpecialty, setSelectedSpecialty] = useState('all')
  const [localDoctorFilter, setLocalDoctorFilter] = useState(
    selectedDoctorFilter,
  )
  const [viewingToday, setViewingToday] = useState(true)
  const [urgentOnly, setUrgentOnly] = useState(false)
  const [hidePastAppointments, setHidePastAppointments] = useState(
    getHidePastAppointmentsPreference,
  )

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (!scopedDoctorId) return

    const channel = supabase
      .channel(`doctor_calendar_${scopedDoctorId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: `medecin_id=eq.${scopedDoctorId}`,
        },
        () => {
          loadData()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [scopedDoctorId, loadData])

  useEffect(() => {
    setLocalDoctorFilter(selectedDoctorFilter)
  }, [selectedDoctorFilter])

  useEffect(() => {
    const timeout = setTimeout(() => setAnimatedStats(true), 100)
    return () => clearTimeout(timeout)
  }, [])

  const medecinsById = useMemo(() => {
    const map = new Map()
    medecins.forEach((medecin) => {
      map.set(String(medecin.id), medecin)
    })
    return map
  }, [medecins])

  const availableSpecialties = useMemo(() => {
    const fromSpecialites = specialites
      .map((spec) => spec.nom?.trim())
      .filter(Boolean)

    if (fromSpecialites.length > 0) {
      return Array.from(new Set(fromSpecialites)).sort((a, b) =>
        a.localeCompare(b, 'fr', { sensitivity: 'accent' }),
      )
    }

    const specialties = new Set()
    medecins.forEach((medecin) => {
      const value = medecin.specialite?.trim()
      if (value) {
        specialties.add(value)
      }
    })
    return Array.from(specialties).sort((a, b) =>
      a.localeCompare(b, 'fr', { sensitivity: 'accent' }),
    )
  }, [medecins, specialites])

  const colorByDoctor = userRole === 'secretary' && !disableDoctorFilter

  const doctorColorMap = useMemo(() => {
    const map = new Map()
    medecins.forEach((medecin, index) => {
      // Utiliser la couleur du médecin depuis la base de données, ou une couleur unique de la palette
      const doctorColor = medecin?.couleur || getDoctorCalendarColor(medecin.id, index)
      map.set(String(medecin.id), doctorColor)
    })
    return map
  }, [medecins])

  const specialtyColorMap = useMemo(() => {
    const map = {}

    availableSpecialties.forEach((specialite, index) => {
      const trimmed = specialite?.trim()
      if (!trimmed) return

      const specData =
        specialites.find(
          (spec) => spec.nom?.trim()?.toLowerCase() === trimmed.toLowerCase(),
        ) ?? null

      const rawColor = specData?.color ?? null

      if (rawColor) {
        map[trimmed] = rawColor
      } else if (!map[trimmed]) {
        map[trimmed] = hashSpecialtyToColor(`${trimmed}-${index}`)
      }
    })

    return map
  }, [availableSpecialties, specialites])

  useEffect(() => {
    if (
      selectedSpecialty !== 'all' &&
      !availableSpecialties.includes(selectedSpecialty)
    ) {
      setSelectedSpecialty('all')
    }
  }, [availableSpecialties, selectedSpecialty])

  const toggleHidePastAppointments = useCallback(() => {
    setHidePastAppointments((prev) => {
      const next = !prev
      setHidePastAppointmentsPreference(next)
      return next
    })
  }, [])

  const toggleUrgentOnly = useCallback(() => {
    setUrgentOnly((prev) => !prev)
  }, [])

  const filteredAppointments = useMemo(() => {
    return appointments.filter((apt) => {
      if (shouldHidePastAppointment(apt, hidePastAppointments)) {
        return false
      }

      if (
        urgentOnly &&
        apt.priorite !== 'urgente' &&
        apt.priorite !== 'tres_urgente'
      ) {
        return false
      }

      const matchesDoctor =
        localDoctorFilter === 'all' ||
        String(apt.medecin_id) === String(localDoctorFilter)

      if (!matchesDoctor) return false

      if (selectedSpecialty !== 'all') {
        const medecin =
          apt.medecin ?? medecinsById.get(String(apt.medecin_id)) ?? null
        const medecinSpecialty = medecin?.specialite?.trim() ?? ''
        if (medecinSpecialty !== selectedSpecialty) {
          return false
        }
      }

      if (selectedSearchResult) {
        if (selectedSearchResult.type === 'patient') {
          return apt.patient_id === selectedSearchResult.id
        }

        if (
          selectedSearchResult.type === 'appointment' &&
          apt.id === selectedSearchResult.id
        ) {
          return true
        }
      }

      if (!searchTerm.trim()) return true

      const term = searchTerm.trim().toLowerCase()
      const patientName = `${apt.patient?.prenom ?? ''} ${
        apt.patient?.nom ?? ''
      }`.toLowerCase()
      const motif = (apt.motif ?? '').toLowerCase()

      return (
        patientName.includes(term) ||
        motif.includes(term) ||
        (apt.patient?.telephone ?? '').toLowerCase().includes(term)
      )
    })
  }, [
    appointments,
    localDoctorFilter,
    medecinsById,
    searchTerm,
    selectedSearchResult,
    selectedSpecialty,
    hidePastAppointments,
    urgentOnly,
  ])

  const calendarEvents = useMemo(() => {
    return filteredAppointments.map((apt) => {
      const startDate = new Date(apt.date_heure)
      const durationMinutes = clampDuration(
        Number(apt.duree ?? DEFAULT_APPOINTMENT_DURATION),
      )
      const endDate =
        apt.heure_fin && apt.heure_fin !== ''
          ? new Date(apt.heure_fin)
          : new Date(startDate.getTime() + durationMinutes * 60000)

      const medecin =
        apt.medecin ?? medecinsById.get(String(apt.medecin_id)) ?? null
      const specialtyName = medecin?.specialite?.trim() ?? ''
      const doctorColor = apt.medecin_id
        ? doctorColorMap.get(String(apt.medecin_id))
        : null
      const color = getEventColor(
        apt.statut,
        apt.priorite,
        specialtyName,
        specialtyColorMap,
        { colorByDoctor, doctorColor },
      )
      const classNames = getEventClassNames(durationMinutes)

      return {
        id: String(apt.id),
        title:
          `${apt.patient?.prenom ?? ''} ${apt.patient?.nom ?? ''}`.trim() ||
          apt.motif ||
          'Rendez-vous',
        start: startDate,
        end: endDate,
        resourceId: apt.medecin_id ? String(apt.medecin_id) : undefined,
        color,
        backgroundColor: color,
        borderColor: color,
        textColor: '#ffffff',
        classNames,
        extendedProps: {
          ...apt,
          patientName: `${apt.patient?.prenom ?? ''} ${
            apt.patient?.nom ?? ''
          }`.trim(),
          specialtyName,
          specialtyColor: color,
          doctorColor: doctorColor ?? color,
          durationMinutes,
        },
      }
    })
  }, [
    filteredAppointments,
    medecinsById,
    specialtyColorMap,
    colorByDoctor,
    doctorColorMap,
  ])

  const visibleMedecins = useMemo(() => {
    return medecins.filter((medecin) => {
      if (
        selectedSpecialty !== 'all' &&
        (medecin.specialite?.trim() ?? '') !== selectedSpecialty
      ) {
        return false
      }
      if (
        localDoctorFilter !== 'all' &&
        String(medecin.id) !== String(localDoctorFilter)
      ) {
        return false
      }
      return true
    })
  }, [localDoctorFilter, medecins, selectedSpecialty])

  const calendarResources = useMemo(() => {
    return visibleMedecins.map((medecin) => {
      const eventColor =
        doctorColorMap.get(String(medecin.id)) ?? '#3b82f6'
      return {
        id: String(medecin.id),
        title: `Dr. ${medecin.prenom ?? ''} ${medecin.nom ?? ''}`.trim(),
        eventColor: colorByDoctor ? eventColor : undefined,
        extendedProps: {
          specialite: medecin.specialite ?? '',
          medecin,
          doctorColor: eventColor,
        },
      }
    })
  }, [visibleMedecins, doctorColorMap, colorByDoctor])

  const dayViewMinWidth = useMemo(() => {
    if (calendarView !== 'timeGridDay') return null
    if (disableDoctorFilter) return null
    // Colonnes réparties sur la largeur disponible (évite le scroll horizontal)
    return null
  }, [calendarView, disableDoctorFilter])

  const stats = useMemo(
    () => buildStats(filteredAppointments),
    [filteredAppointments],
  )

  const getNavigationText = useCallback(() => {
    if (calendarView === 'timeGridDay') return 'Journée'
    if (calendarView === 'dayGridMonth') return 'Mois'
    return 'Semaine'
  }, [calendarView])

  const dayCellClassNames = useCallback((arg) => {
    const classes = []
    if (arg.isToday) classes.push('calendar-cell-today')
    if (arg.isPast && !arg.isToday) classes.push('calendar-cell-past')
    return classes
  }, [])

  const getDateDisplayText = useCallback(() => {
    const calendarApi = calendarRef.current?.getApi()
    if (calendarApi?.view?.title) {
      return calendarApi.view.title
    }
    return selectedDate.toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }, [selectedDate])

  const handlePrev = useCallback(() => {
    const calendarApi = calendarRef.current?.getApi()
    calendarApi?.prev()
  }, [])

  const handleNext = useCallback(() => {
    const calendarApi = calendarRef.current?.getApi()
    calendarApi?.next()
  }, [])

  const handleToday = useCallback(() => {
    const calendarApi = calendarRef.current?.getApi()
    if (!calendarApi) return

    try {
      calendarApi.today()
      // Ensure internal state reflects the active view returned by FullCalendar.
      const viewType = calendarApi.view?.type
      // Map resource view to logical day view for our state naming
      if (viewType === 'resourceTimeGridDay') {
        setCalendarView('timeGridDay')
      } else if (viewType === 'timeGridDay' || viewType === 'timeGridWeek' || viewType === 'dayGridMonth') {
        setCalendarView(viewType)
      }
    } catch (err) {
      console.warn('Erreur lors du déplacement vers aujourd\'hui:', err)
    }
  }, [])

  const handleViewChange = useCallback(
    (view) => {
      const calendarApi = calendarRef.current?.getApi()
      const fullCalendarView = resolveFullCalendarView(view, disableDoctorFilter)

      if (calendarApi) {
        calendarApi.changeView(fullCalendarView)
      }
      setCalendarView(view)
    },
    [disableDoctorFilter],
  )

  const openCreateModalAtDate = useCallback(
    (date, duration = DEFAULT_APPOINTMENT_DURATION) => {
      setEditingAppointment(null)
      setModalInitialDate(date)
      setModalInitialDuration(duration)
      setModalInitialDoctorId(
        disableDoctorFilter && selectedDoctorFilter !== 'all'
          ? String(selectedDoctorFilter)
          : '',
      )
      setModalInitialSpecialty(
        selectedSpecialty !== 'all' ? selectedSpecialty : '',
      )
      setModalInitialPatientId('')
      setShowAppointmentModal(true)
    },
    [disableDoctorFilter, selectedDoctorFilter, selectedSpecialty],
  )

  const handleDateClick = useCallback(
    (clickInfo) => {
      if (calendarView !== 'dayGridMonth') return

      const clicked = new Date(clickInfo.date)
      clicked.setHours(9, 0, 0, 0)
      openCreateModalAtDate(clicked)
    },
    [calendarView, openCreateModalAtDate],
  )

  const selectSearchResult = useCallback(
    (result) => {
      setSelectedSearchResult(result)
      setSearchTerm(result.name ?? '')
      setShowSearchDropdown(false)

      const calendarApi = calendarRef.current?.getApi()
      if (!calendarApi) return

      const dayView = getFullCalendarDayView(disableDoctorFilter)

      if (result.type === 'appointment' && result.date) {
        const targetDate = new Date(result.date)
        calendarApi.gotoDate(targetDate)
        calendarApi.changeView(dayView)
        setCalendarView('timeGridDay')
        if (!disableDoctorFilter && result.medecinId) {
          setLocalDoctorFilter(String(result.medecinId))
        }
      } else if (result.type === 'patient') {
        const patientAppointments = appointments
          .filter((apt) => apt.patient_id === result.id)
          .sort(
            (a, b) =>
              new Date(a.date_heure).getTime() -
              new Date(b.date_heure).getTime(),
          )

        const nextAppointment = disableDoctorFilter
          ? patientAppointments.find(
              (apt) =>
                String(apt.medecin_id) === String(selectedDoctorFilter),
            ) ?? patientAppointments[0]
          : patientAppointments[0]

        if (nextAppointment) {
          const targetDate = new Date(nextAppointment.date_heure)
          calendarApi.gotoDate(targetDate)
          calendarApi.changeView(dayView)
          setCalendarView('timeGridDay')
          if (!disableDoctorFilter && nextAppointment.medecin_id) {
            setLocalDoctorFilter(String(nextAppointment.medecin_id))
          }
        }
      }
    },
    [
      appointments,
      disableDoctorFilter,
      selectedDoctorFilter,
      setSelectedSearchResult,
      setSearchTerm,
      setShowSearchDropdown,
    ],
  )

  const handleDateSelect = useCallback(
    (selectionInfo) => {
      const start = selectionInfo.start
      const end =
        selectionInfo.end ??
        new Date(start.getTime() + DEFAULT_APPOINTMENT_DURATION * 60000)
      const minutes = (end.getTime() - start.getTime()) / (1000 * 60)
      const duration = clampDuration(minutes)
      setEditingAppointment(null)
      setModalInitialDate(start)
      setModalInitialDuration(duration)
      setModalInitialDoctorId(
        selectionInfo.resource
          ? String(selectionInfo.resource.id)
          : disableDoctorFilter && selectedDoctorFilter !== 'all'
            ? String(selectedDoctorFilter)
            : '',
      )
      setModalInitialSpecialty(
        selectionInfo.resource?.extendedProps?.medecin?.specialite
          ? selectionInfo.resource.extendedProps.medecin.specialite
          : selectedSpecialty !== 'all'
          ? selectedSpecialty
          : '',
      )
      setModalInitialPatientId('')
      setShowAppointmentModal(true)
      try {
        if (typeof window !== 'undefined') {
          const hh = start.getHours().toString().padStart(2, '0')
          const mm = start.getMinutes().toString().padStart(2, '0')
          localStorage.setItem('rdv_last_time', `${hh}:${mm}`)
        }
      } catch (error) {
        console.warn(
          "Impossible de stocker l'heure du créneau sélectionné:",
          error,
        )
      }
    },
    [selectedSpecialty, disableDoctorFilter, selectedDoctorFilter],
  )

  const handleEventClick = useCallback(
    (clickInfo) => {
      const event = clickInfo.event
      const appointment = appointments.find(
        (apt) => String(apt.id) === event.id,
      )

      if (!appointment) return

      const eventDuration =
        appointment.duree ??
        clampDuration(
          ((event.end?.getTime() ?? event.start?.getTime() ?? 0) -
            event.start?.getTime()) /
            (1000 * 60),
        )
      setEditingAppointment({
        ...appointment,
        date_heure: appointment.date_heure ?? getIsoString(event.start),
      })
      setModalInitialDuration(eventDuration ?? DEFAULT_APPOINTMENT_DURATION)
      setModalInitialDate(new Date(appointment.date_heure ?? event.start))
      setModalInitialDoctorId(
        appointment.medecin_id ? String(appointment.medecin_id) : '',
      )
      setModalInitialPatientId(
        appointment.patient_id ? String(appointment.patient_id) : '',
      )
      const medecinSpecialite =
        appointment.medecin?.specialite ??
        medecinsById.get(String(appointment.medecin_id))?.specialite ??
        ''
      setModalInitialSpecialty(medecinSpecialite || '')
      setShowAppointmentModal(true)
    },
    [appointments, medecinsById],
  )

  const handleEventDrop = useCallback(
    async (eventDropInfo) => {
      const { event, newResource } = eventDropInfo
      const appointmentId = event.id
      const start = event.start
      const end =
        event.end ??
        new Date(start.getTime() + DEFAULT_APPOINTMENT_DURATION * 60000)

      try {
        await appointmentService.update(
          appointmentId,
          {
            date_heure: getIsoString(start),
            heure_fin: getIsoString(end),
            medecin_id: newResource ? parseInt(newResource.id, 10) : undefined,
            duree: (end.getTime() - start.getTime()) / (1000 * 60),
          },
          currentUser,
        ) // Pass currentUser here
        await loadData()
      } catch (error) {
        console.error(
          'Erreur lors du déplacement du rendez-vous:',
          appointmentService.getErrorMessage(error),
        )
        eventDropInfo.revert()
      }
    },
    [loadData, currentUser],
  )

  const handleEventResize = useCallback(
    async (eventResizeInfo) => {
      const { event } = eventResizeInfo
      const appointmentId = event.id
      const start = event.start
      const end = event.end ?? start

      try {
        await appointmentService.update(
          appointmentId,
          {
            date_heure: getIsoString(start),
            heure_fin: getIsoString(end),
            duree: (end.getTime() - start.getTime()) / (1000 * 60),
          },
          currentUser,
        ) // Pass currentUser here
        await loadData()
      } catch (error) {
        console.error(
          'Erreur lors du redimensionnement du rendez-vous:',
          appointmentService.getErrorMessage(error),
        )
        eventResizeInfo.revert()
      }
    },
    [loadData, currentUser],
  )

  const handleDoctorFilterChange = useCallback((value) => {
    setLocalDoctorFilter(value)
  }, [])

  const handleDatesSet = useCallback((arg) => {
    const nextDate = arg?.start ?? null

    setSelectedDate((prevDate) => {
      if (!prevDate && !nextDate) return prevDate
      if (prevDate && nextDate && prevDate.getTime() === nextDate.getTime()) {
        return prevDate
      }
      return nextDate
    })

    if (arg?.start && arg?.end) {
      const today = new Date()
      today.setHours(12, 0, 0, 0)
      setViewingToday(isDateInRange(today, arg.start, arg.end))
    }
  }, [])

  const createAppointment = async (formData) => {
    try {
      const result = await appointmentService.create(formData, currentUser)
      loadData()
      return result
    } catch (error) {
      console.error(
        'Erreur lors de la création du rendez-vous:',
        appointmentService.getErrorMessage(error),
      )
      throw error
    }
  }

  const updateAppointment = async (id, formData) => {
    try {
      const result = await appointmentService.update(id, formData, currentUser)
      loadData()
      return result
    } catch (error) {
      console.error(
        'Erreur lors de la mise à jour du rendez-vous:',
        appointmentService.getErrorMessage(error),
      )
      throw error
    }
  }

  const reportPastAppointment = useCallback(
    async (appointmentId) => {
      try {
        // Récupérer d'abord le rendez-vous existant
        const { data: existingAppointment, error: fetchError } = await supabase
          .from('appointments')
          .select('*')
          .eq('id', appointmentId)
          .single()

        if (fetchError) {
          throw new Error(`Erreur lors de la récupération du rendez-vous: ${fetchError.message}`)
        }
        if (!existingAppointment) {
          throw new Error('Rendez-vous non trouvé')
        }

        // Mettre à jour directement dans Supabase sans passer par la validation
        // car le rendez-vous est dans le passé et la validation l'interdirait
        const updatedNotes = existingAppointment.notes
          ? `${existingAppointment.notes}\n[Reporté] ${new Date().toLocaleString('fr-FR')}`
          : `[Reporté] ${new Date().toLocaleString('fr-FR')}`

        const { error: updateError } = await supabase
          .from('appointments')
          .update({
            statut: 'annule',
            notes: updatedNotes,
            updated_at: new Date().toISOString(),
          })
          .eq('id', appointmentId)

        if (updateError) {
          throw new Error(`Erreur lors de la mise à jour du rendez-vous: ${updateError.message}`)
        }

        await loadData()
        return true
      } catch (error) {
        console.error(
          'Erreur lors du report du rendez-vous:',
          error.message || error,
        )
        // Renvoyer l'erreur avec un message clair pour l'utilisateur
        throw error
      }
    },
    [loadData, currentUser],
  )

  const deleteAppointment = async (id) => {
    try {
      await appointmentService.deleteAppointmentAndQueue(id)
      loadData()
    } catch (error) {
      console.error(
        'Erreur lors de la suppression du rendez-vous:',
        appointmentService.getErrorMessage(error),
      )
      throw error
    }
  }

  return {
    // State
    loading,
    calendarRef,
    appointments,
    patients,
    medecins,
    specialites,
    calendarView,
    viewingToday,
    selectedDate,
    searchTerm,
    searchResults,
    showSearchDropdown,
    selectedSearchResult,
    showAppointmentModal,
    modalInitialDate,
    modalInitialDuration,
    modalInitialDoctorId,
    modalInitialPatientId,
    modalInitialSpecialty,
    editingAppointment,
    animatedStats,
    selectedSpecialty,
    localDoctorFilter,
    filteredAppointments,
    calendarEvents,
    calendarResources,
    dayViewMinWidth,
    stats,

    // Setters
    setSearchTerm,
    setSearchResults,
    setShowSearchDropdown,
    setSelectedSearchResult,
    setShowAppointmentModal,
    setModalInitialDate,
    setModalInitialDuration,
    setModalInitialDoctorId,
    setModalInitialPatientId,
    setModalInitialSpecialty,
    setEditingAppointment,
    setAnimatedStats,
    setSelectedSpecialty,
    setLocalDoctorFilter,
    setCalendarView,
    setSelectedDate,

    // Handlers & Memoized functions
    loadData,
    medecinsById,
    availableSpecialties,
    specialtyColorMap,
    searchPatientsAndMotifs,
    clearSearch,
    selectSearchResult,
    getNavigationText,
    getDateDisplayText,
    handlePrev,
    handleNext,
    handleToday,
    handleViewChange,
    handleDateClick,
    handleDateSelect,
    dayCellClassNames,
    resolveFullCalendarView: () =>
      resolveFullCalendarView(calendarView, disableDoctorFilter),
    handleEventClick,
    handleEventDrop,
    handleEventResize,
    handleDoctorFilterChange,
    handleDatesSet,
    createAppointment,
    updateAppointment,
    deleteAppointment,
    getAppointmentErrorMessage: appointmentService.getErrorMessage,
    doctorPlanningLabel:
      disableDoctorFilter && medecins.length === 1
        ? `Mon planning — Dr. ${medecins[0].prenom ?? ''} ${medecins[0].nom ?? ''}`.trim()
        : disableDoctorFilter
          ? 'Mon planning'
          : null,
    DEFAULT_APPOINTMENT_DURATION,
    MAX_SELECTION_MINUTES,
    useResourceDayView: !disableDoctorFilter,
    colorByDoctor,
    hidePastAppointments,
    toggleHidePastAppointments,
    urgentOnly,
    toggleUrgentOnly,
    reportPastAppointment,
    RESOURCE_COLUMN_MIN_WIDTH,
    RESOURCE_AREA_WIDTH,
    getEventColor,
    getEventClassNames,
    buildStats,
  }
}