class WorksController < ApplicationController
  before_action :authenticate, only: [:show, :index]

  def index
    @work = random_work
  end

  def show
    @work = Work.find_by(slug: params[:slug]) || random_work
    @work = Work.random.without_slugs([@work.slug]).first if @work.slug == params[:prev_slug]

    current_user&.views&.unshift
    current_user&.views&.<< @work.slug

    @slug = @work&.slug.presence || ""
    @description = @work&.description.presence || ""
  end

  private

  def current_user
    Current.user
  end

  def authenticate
    user_repo = UserRepository.instance
    Current.user = user_repo.find(params[:session_id]) || user_repo.create(SecureRandom.hex(8))
  end

  def random_work
    if current_user
      without_seen_slugs = Work.without_slugs(current_user.views)
      current_user.views.clear if without_seen_slugs.empty?
      without_seen_slugs.first_random.presence || Work.first_random
    else
      Work.first_random.without_slugs(params[:prev_slug])
    end
  end
end
