import React from 'react';
import PropTypes from 'prop-types';
import './Spinner.scss';

function Spinner({ size, style }) {
  return (
    <div className={`${style} ${size}`} role="status">
      <span className="visually-hidden">Loading...</span>
    </div>
  );
}

Spinner.defaultProps = {
  size: '',
  style: 'spinner-border',
};

Spinner.propTypes = {
  style: PropTypes.string,
  size: PropTypes.string,
};

export default Spinner;
