import React from 'react';
import DatePicker from 'react-datepicker';
import PropTypes from 'prop-types';

const DateSelector = ({ selected, onChange, minDate, locale, filterDate }) => {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Date du rendez-vous *</label>
      <DatePicker
        selected={selected}
        onChange={onChange}
        dateFormat="dd/MM/yyyy"
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
        minDate={minDate}
        locale={locale}
        filterDate={filterDate}
      />
    </div>
  );
};

DateSelector.propTypes = {
  selected: PropTypes.oneOfType([PropTypes.instanceOf(Date), PropTypes.string]),
  onChange: PropTypes.func.isRequired,
  minDate: PropTypes.instanceOf(Date),
  locale: PropTypes.string,
  filterDate: PropTypes.func
};

export default DateSelector;
