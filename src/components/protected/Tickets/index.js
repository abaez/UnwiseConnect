import AddProject from './AddProject';
import React, { Component } from 'react';
import Table from './Table';
import { connect } from 'react-redux';
import { fetchTickets } from '../../../helpers/cw';
import { ref } from '../../../config/constants';
import { subscribe } from '../../../actions/tickets';

class Tickets extends Component {
  constructor() {
    super();

    this.addProject = this.addProject.bind(this);
  }

  componentDidMount() {
    this.props.dispatch(subscribe());
  }

  addProject(projectId) {
    fetchTickets(projectId).then(tickets => {
      ref.child(`tickets/${projectId}`)
        .set(tickets);
    });
  }

  render() {
    return (
      <div>
        <h1>Ticket Center</h1>

        <h2>Add Project</h2>
        <AddProject 
          onAdd={this.addProject}
        />

        <h2>Tickets</h2>
        <p>{this.props.tickets.flattened.length} tickets from {Object.keys(this.props.tickets.nested).length} projects.</p>
        {this.props.tickets.flattened.length > 0 && (
          <Table tickets={this.props.tickets.flattened} />
        )}
    </div>
    );
  }
}

const mapStateToProps = state => ({
  tickets: state.tickets,
});

export default connect(mapStateToProps)(Tickets);